import fs from "node:fs/promises"
import { dirExists } from "../shared/dirExists.js"
import { remotePathExists } from "../shared/remotePathExists.js"
import { runRclone } from "../shared/runRclone.js"

export async function syncVideoOriginals(videosDir: string, remoteVideoOriginals: string, cwd: string): Promise<void> {
  const hasLocalVideosDir = await dirExists(videosDir)
  const hasRemoteVideosDir = await remotePathExists(remoteVideoOriginals, cwd)

  if (!hasLocalVideosDir && !hasRemoteVideosDir) {
    return
  }

  if (hasRemoteVideosDir) {
    await fs.mkdir(videosDir, { recursive: true })
    await runRclone(["copy", remoteVideoOriginals, videosDir], cwd)
  }

  if (await dirExists(videosDir)) {
    if (!hasRemoteVideosDir) {
      await runRclone(["mkdir", remoteVideoOriginals], cwd)
    }
    await runRclone(["copy", videosDir, remoteVideoOriginals], cwd)
  }
}
