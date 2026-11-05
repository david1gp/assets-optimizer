import { syncPathsWithFile } from "./syncPathsWithFile.js"
import { syncRemoteRun } from "./syncRemoteRun.js"

export async function syncRemoteDelete(
  remote: string,
  paths: readonly string[],
  date = new Date().toISOString().slice(0, 10),
): Promise<void> {
  if (!paths.length) return
  await syncPathsWithFile(paths, async (file) => {
    await syncRemoteRun([
      "move",
      remote,
      `${remote}/.assets-sync/trash/${date}/${crypto.randomUUID()}`,
      "--files-from-raw",
      file,
    ])
  })
}
