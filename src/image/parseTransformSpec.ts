import { isImageFormat } from "./isImageFormat.js"
import type { TransformSpec } from "./TransformSpec.js"

export function parseTransformSpec(dirName: string): TransformSpec | null {
  const match = /^(?<width>\d+)(?:(?:x|_)(?<height>\d+))?(?:_(?<format>jpg|png|webp|avif))?$/.exec(dirName)
  if (!match?.groups) {
    return null
  }

  const { width: widthValue, height: heightValue, format: formatValue } = match.groups
  if (!widthValue) {
    return null
  }

  const width = Number.parseInt(widthValue, 10)
  const height = Number.parseInt(heightValue ?? widthValue, 10)
  const format = formatValue ?? "webp"
  if (!isImageFormat(format)) {
    return null
  }

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }

  return {
    width,
    height,
    format,
    normalized: `${width}x${height}_${format}`,
  }
}
