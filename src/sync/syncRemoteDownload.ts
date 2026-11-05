import { syncPathsWithFile } from "./syncPathsWithFile.js"
import { syncRemoteRun } from "./syncRemoteRun.js"

export async function syncRemoteDownload(remote: string, local: string, paths: readonly string[]): Promise<void> {
  if (!paths.length) return
  await syncPathsWithFile(paths, async (file) => {
    await syncRemoteRun(["copy", remote, local, "--files-from-raw", file, "--ignore-times"])
  })
}
