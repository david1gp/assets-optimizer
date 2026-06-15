import fs from "node:fs/promises"
import path from "node:path"
import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import { dirExists } from "../shared/dirExists.js"
import type { Logger } from "../shared/logger.js"
import { walkFiles } from "../shared/walkFiles.js"
import { computeVideoPreviewHash } from "./computeVideoPreviewHash.js"
import { createVideoPreviewImage } from "./createVideoPreviewImage.js"
import { createVideoPreviewPath } from "./createVideoPreviewPath.js"
import { removeStaleVideoPreviews } from "./removeStaleVideoPreviews.js"
import { supportedVideoSourceExtensions } from "./supportedVideoSourceExtensions.js"

export async function ensureVideoPreviews(
  videoOptimizedDir: string,
  videoPreviewQuality: number,
  videoPreviewHashLength: number,
  cwd: string,
  result: AssetsOptimizeResult,
  logger: Logger,
): Promise<void> {
  if (!(await dirExists(videoOptimizedDir))) {
    return
  }

  for (const filePath of await walkFiles(videoOptimizedDir)) {
    const extension = path.extname(filePath).toLowerCase()
    if (!supportedVideoSourceExtensions.has(extension)) {
      continue
    }

    const hash = await computeVideoPreviewHash(filePath, videoPreviewQuality, videoPreviewHashLength)
    const previewPath = createVideoPreviewPath(filePath, hash)
    const relativePreviewPath = path.relative(videoOptimizedDir, previewPath)

    try {
      await fs.access(previewPath)
      result.skippedExistingVideoPreviews.push(relativePreviewPath)
      continue
    } catch {}

    await removeStaleVideoPreviews(filePath, previewPath)
    await fs.mkdir(path.dirname(previewPath), { recursive: true })
    await createVideoPreviewImage(filePath, previewPath, videoPreviewQuality, cwd, logger)
    result.processedVideoPreviews.push(relativePreviewPath)
  }
}
