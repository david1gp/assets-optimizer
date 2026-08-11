import type { AiClassification } from "./AiClassification.js"
import type { AiLabelOptions } from "./AiLabelOptions.js"

export function aiLabelAssetFileName(
  classification: AiClassification,
  options: Pick<Required<AiLabelOptions>, "simpleColor" | "visual" | "opacity">,
): string {
  const { simpleColor, visual, opacity } = options

  if (visual === "circle") {
    const transparency = opacity === "opaque" ? "" : "50percent_transparent_"
    return `ai_${simpleColor}_${transparency}circle.svg`
  }

  const transparency = opacity === "opaque" ? "" : "transparent_"
  if (classification === "modified" && simpleColor === "white" && opacity === "50%") {
    return "ai_modified_white transparent_padding.svg"
  }

  return `ai_${classification}_${simpleColor}_${transparency}padding.svg`
}
