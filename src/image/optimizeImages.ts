import path from "node:path"
import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import type { OptimizeImagesOptions } from "./OptimizeImagesOptions.js"
import { generateImageList } from "../list/generateImageList.js"
import { createLogger } from "../shared/logger.js"
import { printSummary } from "../shared/printSummary.js"
import { processImages } from "./processImages.js"

export async function optimizeImages(options: OptimizeImagesOptions = {}): Promise<AssetsOptimizeResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const imageOriginalsDir = path.resolve(cwd, options.imageOriginalsDir ?? "images")
  const imageOptimizedDir = path.resolve(cwd, options.imageOptimizedDir ?? "public/images")
  const imageListOutputPath = path.resolve(cwd, options.imageListOutputPath ?? "src/app/assets/imageList.ts")
  const logger = createLogger(options.logLevel)

  const result: AssetsOptimizeResult = {
    processed: [],
    skippedExisting: [],
    skippedRootFiles: [],
    warnings: [],
    deletedLocal: [],
    processedVideos: [],
    skippedExistingVideos: [],
    processedVideoPreviews: [],
    skippedExistingVideoPreviews: [],
  }

  await processImages({
    imageOriginalsDir,
    imageOptimizedDir,
    allowRootImageFiles: options.allowRootImageFiles === true,
    result,
    logger,
  })

  if (options.generateImageList !== false) {
    await generateImageList(imageOptimizedDir, imageListOutputPath, undefined, logger)
  }

  printSummary(result, logger)
  return result
}