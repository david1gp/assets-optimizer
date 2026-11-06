import { type ApplicationContext, buildCommand } from "@stricli/core"
import type { SyncPlanAction } from "../sync/SyncPlan.js"
import { syncOriginals } from "../sync/syncOriginals.js"

type Flags = {
  local: string
  remote: string
  cwd?: string
  dryRun: boolean
  json: boolean
  prefer?: "local" | "remote"
}

export function syncCommandCreate(status: boolean) {
  return buildCommand<Flags, [], ApplicationContext>({
    parameters: {
      flags: {
        local: { kind: "parsed", parse: String, brief: "Local originals directory", placeholder: "dir" },
        remote: { kind: "parsed", parse: String, brief: "Remote originals path", placeholder: "rclone-path" },
        cwd: { kind: "parsed", parse: String, optional: true, brief: "Working directory", placeholder: "dir" },
        dryRun: { kind: "boolean", default: false, brief: "Show the plan without applying it" },
        json: { kind: "boolean", default: false, brief: "Output a JSON envelope" },
        prefer: {
          kind: "enum",
          values: ["local", "remote"],
          optional: true,
          brief: "Auto-resolve sync conflicts instead of quarantining them",
        },
      },
    },
    docs: { brief: status ? "Show the originals sync plan" : "Synchronize originals" },
    async func(flags) {
      try {
        const result = await syncOriginals({
          localDir: flags.local,
          remotePath: flags.remote,
          cwd: flags.cwd,
          dryRun: status || flags.dryRun,
          logLevel: 0,
          prefer: flags.prefer,
        })
        const symbols: Record<SyncPlanAction, string> = {
          upload: "↑",
          download: "↓",
          "delete-local": "✕",
          "delete-remote": "✕",
          conflict: "⚠",
          none: "",
        }
        const lines = result.plan
          .filter((entry) => entry.action !== "none")
          .map((entry) => `${symbols[entry.action]} ${entry.action} ${entry.path} — ${entry.reason}`)
        const text = lines.length ? lines.join("\n") : `Up to date (catalog v${result.catalogVersion})`
        if (!status && result.summary.conflicts > 0) {
          this.process.exitCode = 1
          const { uploads, downloads, localDeletes, remoteDeletes, conflicts } = result.summary
          const message =
            `Sync completed with ${conflicts} unresolved conflict(s); other paths were synced ` +
            `(${uploads} uploaded, ${downloads} downloaded, ${localDeletes + remoteDeletes} deleted):\n${text}`
          if (flags.json)
            this.process.stdout.write(
              `${JSON.stringify({ success: false, error: { type: "runtime", message }, data: result })}\n`,
            )
          else this.process.stderr.write(`${message}\n`)
          return
        }
        if (flags.json) {
          this.process.stdout.write(`${JSON.stringify({ success: true, data: { ...result, text } })}\n`)
          return
        }
        const { uploads, downloads, localDeletes, remoteDeletes, conflicts } = result.summary
        const summary = lines.length
          ? status || flags.dryRun
            ? `Planned: ${uploads} uploads, ${downloads} downloads, ${localDeletes + remoteDeletes} deletes, ${conflicts} conflicts (catalog v${result.catalogVersion})`
            : `${uploads} uploaded, ${downloads} downloaded, ${localDeletes + remoteDeletes} deleted → catalog v${result.catalogVersion}`
          : text
        this.process.stdout.write(`${lines.length ? `${text}\n` : ""}${summary}\n`)
      } catch (error) {
        this.process.exitCode = 1
        const message = error instanceof Error ? error.message : String(error)
        if (flags.json)
          this.process.stdout.write(`${JSON.stringify({ success: false, error: { type: "runtime", message } })}\n`)
        else this.process.stderr.write(`${message}\n`)
      }
    },
  })
}
