import fs from "node:fs/promises"
import path from "node:path"
import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import type { Logger } from "../shared/logger.js"
import { walkFiles } from "../shared/walkFiles.js"
import { createVideoArgs } from "./createVideoArgs.js"
import { runFfmpeg } from "./runFfmpeg.js"
import { supportedVideoSourceExtensions } from "./supportedVideoSourceExtensions.js"

export async function processLocalVideos(
  videoOriginalsDir: string,
  videoOptimizedDir: string,
  cwd: string,
  result: AssetsOptimizeResult,
  logger: Logger,
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
