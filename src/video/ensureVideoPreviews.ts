import fs from "node:fs/promises"
import path from "node:path"
import type { OptimizeImagesWebResult } from "../AssetsOptimizeResult.js"
import { dirExists } from "../shared/dirExists.js"
import { walkFiles } from "../shared/walkFiles.js"
import { createVideoPreviewArgs } from "./createVideoPreviewArgs.js"
import { createVideoPreviewPath } from "./createVideoPreviewPath.js"
import { runFfmpeg } from "./runFfmpeg.js"
import { supportedVideoSourceExtensions } from "./supportedVideoSourceExtensions.js"

export async function ensureVideoPreviews(
  processedVideosDir: string,
  videoPreviewQuality: number,
  cwd: string,
  result: OptimizeImagesWebResult,
): Promise<void> {
  if (!(await dirExists(processedVideosDir))) {
    return
  }

  for (const filePath of await walkFiles(processedVideosDir)) {
    const extension = path.extname(filePath).toLowerCase()
    if (!supportedVideoSourceExtensions.has(extension)) {
      continue
    }

    const previewPath = createVideoPreviewPath(filePath)
    const relativePreviewPath = path.relative(processedVideosDir, previewPath)

    try {
      await fs.access(previewPath)
      result.skippedExistingVideoPreviews.push(relativePreviewPath)
      continue
    } catch {}

    await fs.mkdir(path.dirname(previewPath), { recursive: true })
    await runFfmpeg(createVideoPreviewArgs(filePath, previewPath, videoPreviewQuality), cwd)
    result.processedVideoPreviews.push(relativePreviewPath)
  }
}
