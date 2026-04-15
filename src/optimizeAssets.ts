import path from "node:path"
import { processImages } from "./image/processImages.js"
import type { OptimizeImagesWebOptions } from "./OptimizeImagesWebOptions.js"
import type { OptimizeImagesWebResult } from "./OptimizeImagesWebResult.js"
import { getProjectName } from "./shared/getProjectName.js"
import { printSummary } from "./shared/printSummary.js"
import { processVideos } from "./video/processVideos.js"

export async function optimizeAssets(options: OptimizeImagesWebOptions = {}): Promise<OptimizeImagesWebResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const projectName = options.projectName ?? (await getProjectName(cwd))
  const imageOriginalsDir = path.resolve(cwd, options.imageOriginalsDir ?? "images")
  const imageOptimizedDir = path.resolve(cwd, options.imageOptimizedDir ?? "public/images")
  const videosDir = path.resolve(cwd, options.videosDir ?? "videos")
  const processedVideosDir = path.resolve(cwd, options.processedVideosDir ?? "public/videos")
  const rcloneRemote = options.rcloneRemote ?? "leo"
  const remoteBase = `${rcloneRemote}:${projectName}`
  const remoteImageOriginals = `${remoteBase}/${options.remoteImageOriginalsDir ?? "image-originals"}`
  const remoteImageOptimized = `${remoteBase}/${options.remoteImageOptimizedDir ?? "image-processed"}`
  const remoteVideoOriginals = `${remoteBase}/${options.remoteVideoOriginalsDir ?? "video-originals"}`
  const remoteVideoProcessed = `${remoteBase}/${options.remoteVideoProcessedDir ?? "video-processed"}`
  const cacheControlHeader = options.cacheControlHeader ?? "public,max-age=31536000,immutable"

  const result: OptimizeImagesWebResult = {
    processed: [],
    skippedExisting: [],
    skippedRootFiles: [],
    warnings: [],
    deletedLocal: [],
    uploadedRemote: [],
    deletedRemote: [],
    processedVideos: [],
    skippedExistingVideos: [],
    uploadedRemoteVideos: [],
  }

  await Promise.all([
    processImages({
      cwd,
      imageOriginalsDir,
      imageOptimizedDir,
      remoteImageOriginals,
      remoteImageOptimized,
      cacheControlHeader,
      result,
    }),
    processVideos({
      cwd,
      videosDir,
      processedVideosDir,
      remoteVideoOriginals,
      remoteVideoProcessed,
      cacheControlHeader,
      result,
    }),
  ])

  printSummary(result)
  return result
}
