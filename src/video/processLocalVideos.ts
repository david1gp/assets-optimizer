import fs from "node:fs/promises"
import path from "node:path"
import type { OptimizeImagesWebResult } from "../AssetsOptimizeResult.js"
import { walkFiles } from "../shared/walkFiles.js"
import { createVideoArgs } from "./createVideoArgs.js"
import { runFfmpeg } from "./runFfmpeg.js"
import { supportedVideoSourceExtensions } from "./supportedVideoSourceExtensions.js"

export async function processLocalVideos(
  videosDir: string,
  processedVideosDir: string,
  cwd: string,
  result: OptimizeImagesWebResult,
): Promise<void> {
  for (const sourceFile of await walkFiles(videosDir)) {
    const extension = path.extname(sourceFile).toLowerCase()
    const relativePath = path.relative(videosDir, sourceFile)

    if (!supportedVideoSourceExtensions.has(extension)) {
      result.warnings.push(`Skipped unsupported video source file: ${relativePath}`)
      console.warn(`Skipped unsupported video source file: ${relativePath}`)
      continue
    }

    const outputPath = path.join(processedVideosDir, relativePath)

    try {
      await fs.access(outputPath)
      result.skippedExistingVideos.push(relativePath)
      continue
    } catch {}

    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await runFfmpeg(await createVideoArgs(sourceFile, outputPath, extension, cwd), cwd)
    result.processedVideos.push(relativePath)
  }
}
