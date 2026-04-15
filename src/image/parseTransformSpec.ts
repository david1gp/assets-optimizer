import { isImageFormat } from "./isImageFormat.js"
import type { TransformSpec } from "./TransformSpec.js"

export function parseTransformSpec(dirName: string): TransformSpec | null {
  const match = /^(?<width>\d+)x(?<height>\d+)_(?<format>jpg|png|webp|avif)$/.exec(dirName)
  if (!match?.groups) {
    return null
  }

  const { width: widthValue, height: heightValue, format: formatValue } = match.groups
  if (!widthValue || !heightValue || !formatValue) {
    return null
  }

  const width = Number.parseInt(widthValue, 10)
  const height = Number.parseInt(heightValue, 10)
  if (!isImageFormat(formatValue)) {
    return null
  }
  const format = formatValue

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
