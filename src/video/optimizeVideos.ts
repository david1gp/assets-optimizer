import fs from "node:fs/promises"
import path from "node:path"
import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import { dirExists } from "../shared/dirExists.js"
import type { OptimizeVideosOptions } from "./OptimizeVideosOptions.js"
import { createLogger } from "../shared/logger.js"
import { printSummary } from "../shared/printSummary.js"
import { supportedVideoSourceExtensions } from "./supportedVideoSourceExtensions.js"
import { walkFiles } from "../shared/walkFiles.js"
import { runFfmpeg } from "./runFfmpeg.js"
import { createVideoArgs } from "./createVideoArgs.js"
import { createVideoPreviewArgs } from "./createVideoPreviewArgs.js"
import { createVideoPreviewPath } from "./createVideoPreviewPath.js"
import { generateVideoList } from "../list/generateVideoList.js"

async function processLocalVideos(
  videoOriginalsDir: string,
  videoOptimizedDir: string,
  cwd: string,
  result: AssetsOptimizeResult,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  for (const sourceFile of await walkFiles(videoOriginalsDir)) {
    const extension = path.extname(sourceFile).toLowerCase()
    const relativePath = path.relative(videoOriginalsDir, sourceFile)

    if (!supportedVideoSourceExtensions.has(extension)) {
      result.warnings.push(`Skipped unsupported video source file: ${relativePath}`)
      continue
    }

    const outputPath = path.join(videoOptimizedDir, relativePath)

    try {
      await fs.access(outputPath)
      result.skippedExistingVideos.push(relativePath)
      continue
    } catch {}

    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await runFfmpeg(await createVideoArgs(sourceFile, outputPath, extension, cwd, logger), cwd, logger)
    result.processedVideos.push(relativePath)
  }
}

async function ensureVideoPreviews(
  videoOptimizedDir: string,
  videoPreviewQuality: number,
  cwd: string,
  result: AssetsOptimizeResult,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  if (!(await dirExists(videoOptimizedDir))) {
    return
  }

  for (const filePath of await walkFiles(videoOptimizedDir)) {
    const extension = path.extname(filePath).toLowerCase()
    if (!supportedVideoSourceExtensions.has(extension)) {
      continue
    }

    const previewPath = createVideoPreviewPath(filePath)
    const relativePreviewPath = path.relative(videoOptimizedDir, previewPath)

    try {
      await fs.access(previewPath)
      result.skippedExistingVideoPreviews.push(relativePreviewPath)
      continue
    } catch {}

    await fs.mkdir(path.dirname(previewPath), { recursive: true })
    await runFfmpeg(createVideoPreviewArgs(filePath, previewPath, videoPreviewQuality), cwd, logger)
    result.processedVideoPreviews.push(relativePreviewPath)
  }
}

export async function optimizeVideos(options: OptimizeVideosOptions = {}): Promise<AssetsOptimizeResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const videoOriginalsDir = path.resolve(cwd, options.videoOriginalsDir ?? "videos")
  const videoOptimizedDir = path.resolve(cwd, options.videoOptimizedDir ?? "public/videos")
  const videoListOutputPath = path.resolve(cwd, options.videoListOutputPath ?? "src/app/assets/videoList.ts")
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

  if (await dirExists(videoOriginalsDir)) {
    await processLocalVideos(videoOriginalsDir, videoOptimizedDir, cwd, result, logger)
  }

  await ensureVideoPreviews(videoOptimizedDir, options.videoPreviewQuality ?? 80, cwd, result, logger)

  if (options.generateVideoList !== false) {
    await generateVideoList(videoOptimizedDir, videoListOutputPath, undefined, logger)
  }

  printSummary(result, logger)
  return result
}