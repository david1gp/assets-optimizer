import { createOutputHashForFile } from "../image/createOutputHashForFile.js"
import { videoPreviewTransformSpec } from "./videoPreviewTransformSpec.js"

/**
 * Content hash for a video's generated preview image, derived from the
 * (optimized) video file plus the preview transform spec. Computed identically
 * by the preview generator and the video list generator so both resolve the
 * same hashed filename without scanning the directory.
 */
export function computeVideoPreviewHash(videoPath: string, quality: number, hashLength = 8): Promise<string> {
  return createOutputHashForFile(videoPath, videoPreviewTransformSpec(quality), hashLength)
}
