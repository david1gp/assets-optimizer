import type { AiClassification } from "./AiClassification.js"
import type { AiLabelOptions } from "./AiLabelOptions.js"
import { aiLabelAssetFileName } from "./aiLabelAssetFileName.js"

export function aiLabelAssetResolve(
  classification: AiClassification,
  options: Pick<Required<AiLabelOptions>, "simpleColor" | "visual" | "opacity">,
): URL {
  const assetDirectory = new URL("../../public/ai/", import.meta.url)
  return new URL(aiLabelAssetFileName(classification, options), assetDirectory)
}
