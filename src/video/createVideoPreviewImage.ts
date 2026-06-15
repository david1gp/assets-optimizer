import fs from "node:fs/promises"
import sharp from "sharp"
import type { Logger } from "../shared/logger.js"
import { runFfmpeg } from "./runFfmpeg.js"

/**
 * Generate an optimized preview image for a video: ffmpeg picks a
 * representative frame (full resolution, no downscale), then sharp re-encodes
 * it to webp at the given quality — the same encoder the image pipeline uses.
 */
export async function createVideoPreviewImage(
  videoPath: string,
  previewPath: string,
  quality: number,
  cwd: string,
  logger?: Logger,
): Promise<void> {
  const framePath = `${previewPath}.frame.png`

  await runFfmpeg(["-y", "-i", videoPath, "-vf", "thumbnail", "-frames:v", "1", "-update", "1", framePath], cwd, logger)

  try {
    const frame = await fs.readFile(framePath)
    await sharp(frame, { animated: false }).webp({ quality }).toFile(previewPath)
  } finally {
    await fs.rm(framePath, { force: true })
  }
}
