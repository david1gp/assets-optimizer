import { imageSize } from "image-size"
import path from "node:path"
import type { TransformSpec } from "./TransformSpec.js"

export function createRootImageTransform(sourceFile: string, sourceBuffer: Buffer): TransformSpec | null {
  const format = getOutputFormat(path.extname(sourceFile).toLowerCase())
  if (!format) {
    return null
  }

  const dimensions = imageSize(sourceBuffer)
  if (!dimensions.width || !dimensions.height) {
    return null
  }

  return {
    width: dimensions.width,
    height: dimensions.height,
    format,
    normalized: `root_${dimensions.width}x${dimensions.height}_${format}`,
  }
}

function getOutputFormat(extension: string): TransformSpec["format"] | null {
  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "jpg"
    case ".png":
      return "png"
    case ".webp":
      return "webp"
    case ".avif":
      return "avif"
    default:
      return null
  }
}
