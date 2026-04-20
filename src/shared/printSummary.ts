import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import type { Logger } from "./logger.js"

export function printSummary(result: AssetsOptimizeResult, logger: Logger): void {
  logger.summary(`Processed ${result.processed.length} new optimized images`)
  logger.summary(`Skipped ${result.skippedExisting.length} existing optimized images`)
  logger.summary(`Skipped ${result.skippedRootFiles.length} root original files`)
  logger.summary(`Deleted ${result.deletedLocal.length} stale local optimized images`)
  logger.summary(`Processed ${result.processedFonts.length} new optimized fonts`)
  logger.summary(`Skipped ${result.skippedExistingFonts.length} existing optimized fonts`)
  logger.summary(`Processed ${result.processedVideos.length} new optimized videos`)
  logger.summary(`Skipped ${result.skippedExistingVideos.length} existing processed videos`)
  logger.summary(`Generated ${result.processedVideoPreviews.length} new video previews`)
  logger.summary(`Skipped ${result.skippedExistingVideoPreviews.length} existing video previews`)

  for (const fileName of result.processed) {
    logger.files(`processed image: ${fileName}`)
  }

  for (const fileName of result.deletedLocal) {
    logger.files(`deleted local image: ${fileName}`)
  }

  for (const fileName of result.processedFonts) {
    logger.files(`processed font: ${fileName}`)
  }

  for (const fileName of result.processedVideos) {
    logger.files(`processed video: ${fileName}`)
  }

  for (const fileName of result.processedVideoPreviews) {
    logger.files(`generated preview: ${fileName}`)
  }

  for (const warning of result.warnings) {
    logger.warn(warning)
  }
}
