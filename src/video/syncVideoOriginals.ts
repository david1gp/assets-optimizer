import fs from "node:fs/promises"
import { dirExists } from "../shared/dirExists.js"
import type { Logger } from "../shared/logger.js"
import { remotePathExists } from "../shared/remotePathExists.js"
import { runRclone } from "../shared/runRclone.js"

export async function syncVideoOriginals(
  videoOriginalsDir: string,
  remoteVideoOriginals: string | undefined,
  cwd: string,
  logger: Logger,
): Promise<void> {
  const hasLocalVideosDir = await dirExists(videoOriginalsDir)
  const hasRemoteVideosDir = remoteVideoOriginals ? await remotePathExists(remoteVideoOriginals, cwd, logger) : false

  if (!hasLocalVideosDir && !hasRemoteVideosDir) {
    return
  }

  if (remoteVideoOriginals && hasRemoteVideosDir) {
    await fs.mkdir(videoOriginalsDir, { recursive: true })
    await runRclone(["copy", remoteVideoOriginals, videoOriginalsDir], cwd, logger)
  }

  if (remoteVideoOriginals && (await dirExists(videoOriginalsDir))) {
    if (!hasRemoteVideosDir) {
      await runRclone(["mkdir", remoteVideoOriginals], cwd, logger)
    }
    await runRclone(["copy", videoOriginalsDir, remoteVideoOriginals], cwd, logger)
  }
}
