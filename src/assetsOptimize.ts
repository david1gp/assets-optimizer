import type { AssetsOptimizeOptions } from "./AssetsOptimizeOptions.js"
import type { AssetsOptimizeResult } from "./AssetsOptimizeResult.js"
import { optimizeImages } from "./image/optimizeImages.js"
import { optimizeVideos } from "./video/optimizeVideos.js"
import { optimizeFonts } from "./font/optimizeFonts.js"

export async function assetsOptimize(options: AssetsOptimizeOptions = {}): Promise<AssetsOptimizeResult> {
  const [imageResult, videoResult, fontResult] = await Promise.all([
    options.processImages !== false
      ? optimizeImages({
          cwd: options.cwd,
          logLevel: options.logLevel,
          imageOriginalsDir: options.imageOriginalsDir,
          imageOptimizedDir: options.imageOptimizedDir,
          allowRootImageFiles: options.allowRootImageFiles,
          imageListOutputPath: options.imageListOutputPath,
          generateImageList: options.generateImageList,
        })
      : Promise.resolve({
          processed: [],
          skippedExisting: [],
          skippedRootFiles: [],
          warnings: [],
          deletedLocal: [],
          processedFonts: [],
          skippedExistingFonts: [],
          processedVideos: [],
          skippedExistingVideos: [],
          processedVideoPreviews: [],
          skippedExistingVideoPreviews: [],
        }),
    options.processVideos !== false
      ? optimizeVideos({
          cwd: options.cwd,
          logLevel: options.logLevel,
          videoOriginalsDir: options.videoOriginalsDir,
          videoOptimizedDir: options.videoOptimizedDir,
          videoListOutputPath: options.videoListOutputPath,
          generateVideoList: options.generateVideoList,
          videoPreviewQuality: options.videoPreviewQuality,
        })
      : Promise.resolve({
          processed: [],
          skippedExisting: [],
          skippedRootFiles: [],
          warnings: [],
          deletedLocal: [],
          processedFonts: [],
          skippedExistingFonts: [],
          processedVideos: [],
          skippedExistingVideos: [],
          processedVideoPreviews: [],
          skippedExistingVideoPreviews: [],
        }),
    options.processFonts !== false
      ? optimizeFonts({
          cwd: options.cwd,
          logLevel: options.logLevel,
          fontOriginalsDir: options.fontOriginalsDir,
          fontOptimizedDir: options.fontOptimizedDir,
          fontListOutputPath: options.fontListOutputPath,
          generateFontList: options.generateFontList,
        })
      : Promise.resolve({
          processed: [],
          skippedExisting: [],
          skippedRootFiles: [],
          warnings: [],
          deletedLocal: [],
          processedFonts: [],
          skippedExistingFonts: [],
          processedVideos: [],
          skippedExistingVideos: [],
          processedVideoPreviews: [],
          skippedExistingVideoPreviews: [],
        }),
  ])

  const result: AssetsOptimizeResult = {
    processed: imageResult.processed,
    skippedExisting: imageResult.skippedExisting,
    skippedRootFiles: imageResult.skippedRootFiles,
    warnings: [...imageResult.warnings, ...videoResult.warnings, ...fontResult.warnings],
    deletedLocal: imageResult.deletedLocal,
    processedFonts: fontResult.processedFonts,
    skippedExistingFonts: fontResult.skippedExistingFonts,
    processedVideos: videoResult.processedVideos,
    skippedExistingVideos: videoResult.skippedExistingVideos,
    processedVideoPreviews: videoResult.processedVideoPreviews,
    skippedExistingVideoPreviews: videoResult.skippedExistingVideoPreviews,
  }

  return result
}
