import { runRcloneCapture } from "../rclone/runRcloneCapture.js"
import { isConflictFile } from "../shared/isConflictFile.js"
import { isIgnoredDir } from "../shared/isIgnoredDir.js"
import type { SyncRemoteListing } from "./SyncPlan.js"

export async function syncRemoteList(remote: string): Promise<SyncRemoteListing> {
  // Include directories in validation too: duplicate Drive folder names make
  // their children ambiguous even when the child filenames differ.
  const result = await runRcloneCapture(["lsjson", remote, "-R", "--exclude", "/.assets-sync/**"])
  if (result.exitCode !== 0) {
    // On a missing directory rclone may emit only an opening '['. A failed
    // listing containing any entries must not be mistaken for an empty remote.
    if (result.exitCode === 3 && (!result.stdout.trim() || /^\[\s*\]?$/.test(result.stdout.trim()))) return {}
    throw new Error(`rclone lsjson failed (${result.exitCode}): ${result.stderr}`)
  }
  const files = JSON.parse(result.stdout) as { Path: string; Size: number; ModTime: string; IsDir?: boolean }[]
  const paths = new Set<string>()
  for (const file of files) {
    if (
      typeof file.Path !== "string" ||
      /[\r\n\\]/.test(file.Path) ||
      file.Path.split("/").some((part) => !part || part === "." || part === "..") ||
      file.Path.split("/")[0] === ".assets-sync"
    )
      throw new Error(`Invalid remote sync path: ${JSON.stringify(file.Path)}`)
    // Drive permits duplicate names. Never silently collapse them and then
    // transfer or delete an arbitrary original by its ambiguous path.
    if (paths.has(file.Path)) throw new Error(`Duplicate remote sync path: ${file.Path}; resolve duplicates first`)
    paths.add(file.Path)
  }
  return Object.fromEntries(
    files
      .filter((file) => {
        if (file.IsDir) return false
        const parts = file.Path.split("/")
        // Match the local scan's scope. Otherwise an ignored remote file is
        // downloaded forever but cannot be hashed/adopted into the catalog.
        return (
          !parts.some((part) => part.startsWith(".")) &&
          !parts.slice(0, -1).some((part) => isIgnoredDir(part)) &&
          !isConflictFile(parts.at(-1)!)
        )
      })
      .map((file) => [file.Path, { size: file.Size, modTime: file.ModTime }]),
  )
}
