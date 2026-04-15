import path from "node:path"
import type { OptimizeImagesWebOptions } from "./AssetsOptimizeOptions.js"
import type { OptimizeImagesWebResult } from "./AssetsOptimizeResult.js"
import { processImages } from "./image/processImages.js"
import { generateImageList } from "./list/generateImageList.js"
import { generateVideoList } from "./list/generateVideoList.js"
import { getProjectName } from "./shared/getProjectName.js"
import { printSummary } from "./shared/printSummary.js"
import { processVideos } from "./video/processVideos.js"

export async function assetsOptimize(options: OptimizeImagesWebOptions = {}): Promise<OptimizeImagesWebResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const projectName = options.projectName ?? (await getProjectName(cwd))
  const processImagesEnabled = options.processImages !== false
  const processVideosEnabled = options.processVideos !== false
  const imageOriginalsDir = path.resolve(cwd, options.imageOriginalsDir ?? "images")
  const imageOptimizedDir = path.resolve(cwd, options.imageOptimizedDir ?? "public/images")
  const imageListOutputPath = path.resolve(cwd, options.imageListOutputPath ?? "src/app/assets/imageList.ts")
  const videosDir = path.resolve(cwd, options.videosDir ?? "videos")
  const processedVideosDir = path.resolve(cwd, options.processedVideosDir ?? "public/videos")
  const videoListOutputPath = path.resolve(cwd, options.videoListOutputPath ?? "src/app/assets/videoList.ts")
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
        })
      : Promise.resolve(),
    processVideosEnabled
      ? processVideos({
          cwd,
          videosDir,
          processedVideosDir,
          remoteVideoOriginals,
          remoteVideoProcessed,
          cacheControlHeader,
          videoPreviewQuality: options.videoPreviewQuality ?? 80,
          result,
        })
      : Promise.resolve(),
  ])

  await Promise.all([
    options.generateImageList === false
      ? Promise.resolve()
      : generateImageList(imageOptimizedDir, imageListOutputPath, options.imageListImportPath),
    options.generateVideoList === false
      ? Promise.resolve()
      : generateVideoList(processedVideosDir, videoListOutputPath, options.videoListImportPath),
  ])

  printSummary(result)
  return result
}
