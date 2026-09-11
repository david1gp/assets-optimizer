import { existsSync, realpathSync } from "node:fs"
import { release as osRelease } from "node:os"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { type ApplicationContext, buildCommand } from "@stricli/core"
import pkg from "../../package.json" with { type: "json" }
import { packageVersion } from "../packageVersion.js"

type VersionFlags = {
  readonly verbose: boolean
}

type PackageMetadata = {
  readonly name?: string
  readonly description?: string
  readonly author?: string | { readonly name?: string; readonly url?: string }
  readonly license?: string
  readonly homepage?: string
  readonly repository?: { readonly url?: string }
  readonly engines?: Readonly<Record<string, string>>
}

const packageMetadata = pkg as PackageMetadata

export const versionCommand = buildCommand<VersionFlags, [], ApplicationContext>({
  parameters: {
    flags: {
      verbose: {
        kind: "boolean",
        brief: "Include package and runtime details.",
        default: false,
      },
    },
    aliases: { v: "verbose" },
  },
  docs: {
    brief: "Print the assets-optimizer version.",
  },
  func(flags) {
    this.process.stdout.write(flags.verbose ? versionMetadataRender() : `${packageVersion}\n`)
  },
})

function versionMetadataRender(): string {
  const executable = executableResolve()
  const requirements = Object.entries(packageMetadata.engines ?? {})
    .map(([runtime, requirement]) => `${runtime} ${requirement}`)
    .join(", ")
  const runtime = typeof Bun === "undefined" ? `${process.release.name} ${process.version}` : `bun ${Bun.version}`
  const packageName = packageMetadata.name ?? "unavailable"

  return [
    `${packageName} v${packageVersion}`,
    `user agent: ${packageName}/${packageVersion}`,
    `executable: ${executable.entrypoint}`,
    `executable target: ${executable.target ?? "unavailable"}`,
    `version: ${packageVersion}`,
    `description: ${packageMetadata.description ?? "unavailable"}`,
    `author: ${authorRender()}`,
    `license: ${packageMetadata.license ?? "unavailable"}`,
    `project: ${packageMetadata.homepage ?? packageMetadata.repository?.url ?? "unavailable"}`,
    `installation type: ${installationTypeResolve(executable.target)}`,
    `runtime: ${runtime}`,
    `runtime requirements: ${requirements || "unavailable"}`,
    `platform: ${process.platform} ${process.arch} (OS release ${osRelease()})`,
    "",
  ].join("\n")
}

function executableResolve(): { readonly entrypoint: string; readonly target?: string } {
  const entrypoint = process.argv[1]
  if (entrypoint === undefined) return { entrypoint: "unavailable" }

  const resolvedEntrypoint = resolve(entrypoint)
  try {
    return { entrypoint: resolvedEntrypoint, target: realpathSync(resolvedEntrypoint) }
  } catch {
    return { entrypoint: resolvedEntrypoint }
  }
}

function installationTypeResolve(executableTarget: string | undefined): string {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
  if (existsSync(resolve(packageRoot, ".git"))) return "development checkout"
  if (executableTarget !== undefined && !relative(packageRoot, executableTarget).startsWith(".."))
    return "package installation"
  return "unknown"
}

function authorRender(): string {
  const author = packageMetadata.author
  if (typeof author === "string") return author
  if (author === undefined) return "unavailable"
  return [author.name, author.url].filter(Boolean).join(" — ") || "unavailable"
}
