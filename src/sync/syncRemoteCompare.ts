import { runRcloneCapture } from "../rclone/runRcloneCapture.js"
import { syncPathsWithFile } from "./syncPathsWithFile.js"

export async function syncRemoteCompare(local: string, remote: string, paths: readonly string[]): Promise<Set<string>> {
  if (!paths.length) return new Set()
  return syncPathsWithFile(paths, async (file) => {
    const result = await runRcloneCapture(["check", local, remote, "--files-from-raw", file, "--combined", "-"])
    if (result.exitCode !== 0 && result.exitCode !== 1)
      throw new Error(`rclone check failed (${result.exitCode}): ${result.stderr}`)
    if (result.exitCode === 1 && !result.stdout.trim()) throw new Error(`rclone check failed: ${result.stderr}`)
    if (result.stdout.split("\n").some((line) => line.startsWith("! ")))
      throw new Error(`rclone check could not read files: ${result.stderr}`)
    return new Set(
      result.stdout
        .split("\n")
        .filter((line) => line.startsWith("= "))
        .map((line) => line.slice(2)),
    )
  })
}
