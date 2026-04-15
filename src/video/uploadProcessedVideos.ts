import path from "node:path"
import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import { listLocalFiles } from "../shared/listLocalFiles.js"
import { listRemoteFiles } from "../shared/listRemoteFiles.js"
import type { Logger } from "../shared/logger.js"
import { remotePathExists } from "../shared/remotePathExists.js"
import { runRclone } from "../shared/runRclone.js"
import { supportedVideoSourceExtensions } from "./supportedVideoSourceExtensions.js"

export async function uploadProcessedVideos(
  videoOptimizedDir: string,
  remoteVideoProcessed: string | undefined,
  cacheControlHeader: string,
  cwd: string,
  result: AssetsOptimizeResult,
  logger: Logger,
): Promise<void> {
  if (!remoteVideoProcessed) {
    return
  }

  const localProcessedVideos = await listLocalFiles(videoOptimizedDir)
  if (localProcessedVideos.length === 0) {
    return
  }

  const hasRemoteProcessedVideosDir = await remotePathExists(remoteVideoProcessed, cwd, logger)
  const remoteProcessedVideos = hasRemoteProcessedVideosDir
    ? new Set(await listRemoteFiles(remoteVideoProcessed, cwd, logger))
    : new Set<string>()

  if (!hasRemoteProcessedVideosDir) {
    await runRclone(["mkdir", remoteVideoProcessed], cwd, logger)
  }

  for (const localFile of localProcessedVideos) {
    const relativePath = path.relative(videoOptimizedDir, localFile)
    if (relativePath.startsWith(".") || remoteProcessedVideos.has(relativePath)) {
      continue
    }

    await runRclone(
      [
        "copyto",
        "--header-upload",
        `Cache-Control: ${cacheControlHeader}`,
        localFile,
        `${remoteVideoProcessed}/${relativePath}`,
      ],
      cwd,
      logger,
    )

    if (supportedVideoSourceExtensions.has(path.extname(localFile).toLowerCase())) {
      result.uploadedRemoteVideos.push(relativePath)
      continue
    }

    result.uploadedRemoteVideoPreviews.push(relativePath)
  }
}
