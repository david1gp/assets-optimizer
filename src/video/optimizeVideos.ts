import path from "node:path"
import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import { generateVideoList } from "../list/generateVideoList.js"
import { dirExists } from "../shared/dirExists.js"
import { createLogger } from "../shared/logger.js"
import { printSummary } from "../shared/printSummary.js"
import { ensureVideoPreviews } from "./ensureVideoPreviews.js"
import type { OptimizeVideosOptions } from "./OptimizeVideosOptions.js"
import { processLocalVideos } from "./processLocalVideos.js"

export async function optimizeVideos(options: OptimizeVideosOptions = {}): Promise<AssetsOptimizeResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const videoOriginalsDir = path.resolve(cwd, options.videoOriginalsDir ?? "videos")
  const videoOptimizedDir = path.resolve(cwd, options.videoOptimizedDir ?? "public/videos")
  const videoListOutputPath = path.resolve(cwd, options.videoListOutputPath ?? "src/app/assets/videoList.ts")
  const videoPreviewQuality = options.videoPreviewQuality ?? 65
  const videoPreviewHashLength = options.videoPreviewHashLength ?? 8
  const logger = createLogger(options.logLevel)

  const result: AssetsOptimizeResult = {
    processed: [],
    skippedExisting: [],
    warnings: [],
    deletedLocal: [],
    processedFonts: [],
    skippedExistingFonts: [],
    processedVideos: [],
    skippedExistingVideos: [],
    processedVideoPreviews: [],
    skippedExistingVideoPreviews: [],
  }

  if (await dirExists(videoOriginalsDir)) {
    await processLocalVideos(videoOriginalsDir, videoOptimizedDir, cwd, result, logger)
  }

  await ensureVideoPreviews(videoOptimizedDir, videoPreviewQuality, videoPreviewHashLength, cwd, result, logger)

  if (options.generateVideoList !== false) {
    await generateVideoList(
      videoOptimizedDir,
      videoListOutputPath,
      videoPreviewQuality,
      videoPreviewHashLength,
      undefined,
      logger,
    )
  }

  printSummary(result, logger)
  return result
}
