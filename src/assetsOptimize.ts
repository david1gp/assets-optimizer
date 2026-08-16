import type { AssetsOptimizeOptions } from "./AssetsOptimizeOptions.js"
import type { AssetsOptimizeResult } from "./AssetsOptimizeResult.js"
import { assetsOptimizeOptionsValidate } from "./assetsOptimizeOptionsValidate.js"
import { optimizeFonts } from "./font/optimizeFonts.js"
import { optimizeImages } from "./image/optimizeImages.js"
import { optimizeVideos } from "./video/optimizeVideos.js"

export async function assetsOptimize(options: AssetsOptimizeOptions = {}): Promise<AssetsOptimizeResult> {
  const validatedOptions = assetsOptimizeOptionsValidate(options)

  const [imageResult, videoResult, fontResult] = await Promise.all([
    validatedOptions.processImages !== false
      ? optimizeImages({
          cwd: validatedOptions.cwd,
          logLevel: validatedOptions.logLevel,
          imageOriginalsDir: validatedOptions.imageOriginalsDir,
          imageOptimizedDir: validatedOptions.imageOptimizedDir,
          allowRootImageFiles: validatedOptions.allowRootImageFiles,
          imageHashLength: validatedOptions.imageHashLength,
          ignoredDirNames: validatedOptions.ignoredDirNames,
          imageFilterDirs: validatedOptions.imageFilterDirs,
          aiLabelOptions: validatedOptions.aiLabelOptions,
          imageTypeImportPath: validatedOptions.imageTypeImportPath,
          imageListOutputPath: validatedOptions.imageListOutputPath,
          generateImageList: validatedOptions.generateImageList,
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
    validatedOptions.processVideos !== false
      ? optimizeVideos({
          cwd: validatedOptions.cwd,
          logLevel: validatedOptions.logLevel,
          videoOriginalsDir: validatedOptions.videoOriginalsDir,
          videoOptimizedDir: validatedOptions.videoOptimizedDir,
          videoListOutputPath: validatedOptions.videoListOutputPath,
          generateVideoList: validatedOptions.generateVideoList,
          videoPreviewQuality: validatedOptions.videoPreviewQuality,
          videoPreviewHashLength: validatedOptions.videoPreviewHashLength,
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
    validatedOptions.processFonts !== false
      ? optimizeFonts({
          cwd: validatedOptions.cwd,
          logLevel: validatedOptions.logLevel,
          fontOriginalsDir: validatedOptions.fontOriginalsDir,
          fontOptimizedDir: validatedOptions.fontOptimizedDir,
          fontListOutputPath: validatedOptions.fontListOutputPath,
          generateFontList: validatedOptions.generateFontList,
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
