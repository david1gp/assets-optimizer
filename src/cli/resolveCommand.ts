import { type ApplicationContext, buildCommand } from "@stricli/core"
import type { SyncResolveConflict, SyncResolveResult } from "../sync/SyncResolveResult.js"
import { syncResolve } from "../sync/syncResolve.js"

type Flags = {
  local: string
  cwd?: string
  keep?: "local" | "remote" | "both"
  json: boolean
}

export const resolveCommand = buildCommand<Flags, string[], ApplicationContext>({
  parameters: {
    flags: {
      local: { kind: "parsed", parse: String, brief: "Local originals directory", placeholder: "dir" },
      cwd: { kind: "parsed", parse: String, optional: true, brief: "Working directory", placeholder: "dir" },
      keep: {
        kind: "enum",
        values: ["local", "remote", "both"],
        optional: true,
        brief: "Which side to keep (without it, only list conflicts)",
      },
      json: { kind: "boolean", default: false, brief: "Output a JSON envelope" },
    },
    positional: {
      kind: "array",
      parameter: {
        parse: String,
        brief: "Conflicted paths to resolve (default: all outstanding conflicts)",
        placeholder: "path",
      },
    },
  },
  docs: { brief: "List or resolve sync conflicts" },
  async func(flags, ...paths) {
    try {
      const result = await syncResolve({
        localDir: flags.local,
        cwd: flags.cwd,
        keep: flags.keep,
        paths: paths.length ? paths : undefined,
      })
      const text = resolveText(result, flags.keep)
      if (result.summary.failed > 0) {
        this.process.exitCode = 1
        const failed = result.conflicts.filter((conflict) => conflict.action === "error")
        const message = `Resolve completed with ${failed.length} failed path(s):\n${failed
          .map((conflict) => `✕ ${conflict.path} — ${conflict.error}`)
          .join("\n")}`
        if (flags.json) {
          this.process.stdout.write(
            `${JSON.stringify({ success: false, error: { type: "runtime", message }, data: result })}\n`,
          )
        } else {
          this.process.stdout.write(`${text}\n`)
          this.process.stderr.write(`${message}\n`)
        }
        return
      }
      if (flags.json) {
        this.process.stdout.write(`${JSON.stringify({ success: true, data: { ...result, text } })}\n`)
        return
      }
      this.process.stdout.write(`${text}\n`)
    } catch (error) {
      this.process.exitCode = 1
      const message = error instanceof Error ? error.message : String(error)
      if (flags.json) {
        this.process.stdout.write(`${JSON.stringify({ success: false, error: { type: "runtime", message } })}\n`)
      } else {
        this.process.stderr.write(`${message}\n`)
      }
    }
  },
})

function resolveText(result: SyncResolveResult, keep: Flags["keep"]): string {
  if (!result.conflicts.length) return "No outstanding conflicts"
  const blocks = result.conflicts.map((conflict) => conflictText(conflict))
  const guidance = keep === undefined ? "Pass --keep local|remote|both to resolve" : "Run sync to apply the resolution"
  return [...blocks, guidance].join("\n")
}

function conflictText(conflict: SyncResolveConflict): string {
  const lines = [`⚠ ${conflict.path}`, `  local: ${sideText(conflict.local, "local file")}`]
  const copyLabel = conflict.copyPath ? `copy ${conflict.copyPath}` : "remote copy"
  const catalog =
    conflict.remote.updatedAt || conflict.remote.updatedBy
      ? `, updated ${conflict.remote.updatedAt ?? "?"} by ${conflict.remote.updatedBy ?? "?"}`
      : ""
  lines.push(`  remote: ${copyLabel}, ${sideText(conflict.remote)}${catalog}`)
  if (conflict.pixels) lines.push(`  pixels: ${conflict.pixels}`)
  if (conflict.note) lines.push(`  note: ${conflict.note}`)
  lines.push(`  → ${outcomeText(conflict)}`)
  return lines.join("\n")
}

function sideText(side: SyncResolveConflict["local"], missingLabel = "missing"): string {
  if (!side.exists) return missingLabel
  const parts = [`${side.size} bytes`, `mtime ${side.mtime}`]
  if (side.sha256) parts.push(`sha256 ${side.sha256}`)
  if (side.width && side.height) parts.push(`${side.width}x${side.height}${side.format ? ` ${side.format}` : ""}`)
  return parts.join(", ")
}

function outcomeText(conflict: SyncResolveConflict): string {
  switch (conflict.action) {
    case "listed":
      return "unresolved (list-only)"
    case "kept-local":
      return "kept local (deleted the copy)"
    case "kept-remote":
      return "kept remote (replaced the local file with the copy)"
    case "kept-both":
      return `kept both (renamed the copy to ${conflict.targetPath})`
    case "error":
      return `failed: ${conflict.error}`
  }
}
