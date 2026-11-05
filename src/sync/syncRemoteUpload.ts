import { syncPathsWithFile } from "./syncPathsWithFile.js"
import { syncRemoteRun } from "./syncRemoteRun.js"

export async function syncRemoteUpload(
  local: string,
  remote: string,
  paths: readonly string[],
  date = new Date().toISOString().slice(0, 10),
): Promise<void> {
  if (!paths.length) return
  await syncPathsWithFile(paths, async (file) => {
    await syncRemoteRun([
      "copy",
      local,
      remote,
      "--files-from-raw",
      file,
      "--ignore-times",
      "--backup-dir",
      `${remote}/.assets-sync/trash/${date}/${crypto.randomUUID()}`,
    ])
  })
}
