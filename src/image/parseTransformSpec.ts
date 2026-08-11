import type { AiClassification } from "./AiClassification.js"
import { isImageFormat } from "./isImageFormat.js"
import type { TransformSpec } from "./TransformSpec.js"

export function parseTransformSpec(dirName: string): TransformSpec | null {
  const match =
    /^(?<width>\d+)(?:(?:x|_)(?<height>\d+))?(?:_(?<format>jpg|png|webp|avif))?(?:_ai_(?<aiClassification>generated|modified))?$/.exec(
      dirName,
    )
  if (!match?.groups) {
    return null
  }

  const {
    width: widthValue,
    height: heightValue,
    format: formatValue,
    aiClassification: aiClassificationValue,
  } = match.groups
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

  const aiClassification = parseAiClassification(aiClassificationValue)

  return {
    width,
    height,
    format,
    ...(aiClassification ? { aiClassification } : {}),
    normalized: `${width}x${height}_${format}${aiClassification ? `_ai_${aiClassification}` : ""}`,
  }
}

function parseAiClassification(value: string | undefined): AiClassification | null {
  if (value === "generated" || value === "modified") {
    return value
  }

  return null
}
