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
    processedVideosDir,
    remoteVideoOriginals,
    remoteVideoProcessed,
    result,
    videoPreviewQuality,
    videosDir,
  } = options

  await syncVideoOriginals(videosDir, remoteVideoOriginals, cwd)

  const hasRemoteProcessedVideosDir = await remotePathExists(remoteVideoProcessed, cwd)
  if (hasRemoteProcessedVideosDir) {
    await fs.mkdir(processedVideosDir, { recursive: true })
    await runRclone(["copy", "--ignore-existing", remoteVideoProcessed, processedVideosDir], cwd)
  }

  if (await dirExists(videosDir)) {
    await processLocalVideos(videosDir, processedVideosDir, cwd, result)
  }

  await ensureVideoPreviews(processedVideosDir, videoPreviewQuality, cwd, result)
  await uploadProcessedVideos(processedVideosDir, remoteVideoProcessed, cacheControlHeader, cwd, result)
}
