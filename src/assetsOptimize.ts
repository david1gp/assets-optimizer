import path from "node:path"
import type { AssetsOptimizeOptions } from "./AssetsOptimizeOptions.js"
import type { AssetsOptimizeResult } from "./AssetsOptimizeResult.js"
import { processImages } from "./image/processImages.js"
import { generateImageList } from "./list/generateImageList.js"
import { generateVideoList } from "./list/generateVideoList.js"
import { getProjectName } from "./shared/getProjectName.js"
import { createLogger } from "./shared/logger.js"
import { printSummary } from "./shared/printSummary.js"
import { processVideos } from "./video/processVideos.js"

export async function assetsOptimize(options: AssetsOptimizeOptions = {}): Promise<AssetsOptimizeResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const projectName = options.projectName ?? (await getProjectName(cwd))
  const processImagesEnabled = options.processImages !== false
  const processVideosEnabled = options.processVideos !== false
  const imageOriginalsDir = path.resolve(cwd, options.imageOriginalsDir ?? "images")
  const imageOptimizedDir = path.resolve(cwd, options.imageOptimizedDir ?? "public/images")
  const imageListOutputPath = path.resolve(cwd, options.imageListOutputPath ?? "src/app/assets/imageList.ts")
  const videoOriginalsDir = path.resolve(cwd, options.videoOriginalsDir ?? "videos")
  const videoOptimizedDir = path.resolve(cwd, options.videoOptimizedDir ?? "public/videos")
  const videoListOutputPath = path.resolve(cwd, options.videoListOutputPath ?? "src/app/assets/videoList.ts")
  const remoteBase = options.rcloneRemote ? `${options.rcloneRemote}:${projectName}` : undefined
  const remoteImageOriginals = remoteBase
    ? `${remoteBase}/${options.remoteImageOriginalsDir ?? "image-originals"}`
    : undefined
  const remoteImageOptimized = remoteBase
    ? `${remoteBase}/${options.remoteImageOptimizedDir ?? "image-processed"}`
    : undefined
  const remoteVideoOriginals = remoteBase
    ? `${remoteBase}/${options.remoteVideoOriginalsDir ?? "video-originals"}`
    : undefined
  const remoteVideoProcessed = remoteBase
    ? `${remoteBase}/${options.remoteVideoProcessedDir ?? "video-processed"}`
    : undefined
  const cacheControlHeader = options.cacheControlHeader ?? "public,max-age=31536000,immutable"
  const logger = createLogger(options.logLevel)

  const result: AssetsOptimizeResult = {
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
    processedVideoPreviews: [],
    skippedExistingVideoPreviews: [],
    uploadedRemoteVideoPreviews: [],
  }

  await Promise.all([
    processImagesEnabled
      ? processImages({
          cwd,
          imageOriginalsDir,
          imageOptimizedDir,
          allowRootImageFiles: options.allowRootImageFiles === true,
          remoteImageOriginals,
          remoteImageOptimized,
          cacheControlHeader,
          result,
          logger,
        })
      : Promise.resolve(),
    processVideosEnabled
      ? processVideos({
          cwd,
          videoOriginalsDir,
          videoOptimizedDir,
          remoteVideoOriginals,
          remoteVideoProcessed,
          cacheControlHeader,
          videoPreviewQuality: options.videoPreviewQuality ?? 80,
          result,
          logger,
        })
      : Promise.resolve(),
  ])

  await Promise.all([
    options.generateImageList === false
      ? Promise.resolve()
      : generateImageList(imageOptimizedDir, imageListOutputPath, options.imageListImportPath, logger),
    options.generateVideoList === false
      ? Promise.resolve()
      : generateVideoList(videoOptimizedDir, videoListOutputPath, options.videoListImportPath, logger),
  ])

  printSummary(result, logger)
  return result
}
