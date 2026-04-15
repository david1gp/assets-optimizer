import fs from "node:fs/promises"
import { dirExists } from "../shared/dirExists.js"
import { remotePathExists } from "../shared/remotePathExists.js"
import { runRclone } from "../shared/runRclone.js"
import { ensureVideoPreviews } from "./ensureVideoPreviews.js"
import type { ProcessVideosOptions } from "./ProcessVideosOptions.js"
import { processLocalVideos } from "./processLocalVideos.js"
import { syncVideoOriginals } from "./syncVideoOriginals.js"
import { uploadProcessedVideos } from "./uploadProcessedVideos.js"

export async function processVideos(options: ProcessVideosOptions): Promise<void> {
  const {
    cacheControlHeader,
    cwd,
    logger,
    videoOptimizedDir,
    remoteVideoOriginals,
    remoteVideoProcessed,
    result,
    videoPreviewQuality,
    videoOriginalsDir,
  } = options

  await syncVideoOriginals(videoOriginalsDir, remoteVideoOriginals, cwd, logger)

  const hasRemoteProcessedVideosDir = remoteVideoProcessed
    ? await remotePathExists(remoteVideoProcessed, cwd, logger)
    : false
  if (remoteVideoProcessed && hasRemoteProcessedVideosDir) {
    await fs.mkdir(videoOptimizedDir, { recursive: true })
    await runRclone(["copy", "--ignore-existing", remoteVideoProcessed, videoOptimizedDir], cwd, logger)
  }

  if (await dirExists(videoOriginalsDir)) {
    await processLocalVideos(videoOriginalsDir, videoOptimizedDir, cwd, result, logger)
  }

  await ensureVideoPreviews(videoOptimizedDir, videoPreviewQuality, cwd, result, logger)
  await uploadProcessedVideos(videoOptimizedDir, remoteVideoProcessed, cacheControlHeader, cwd, result, logger)
}
