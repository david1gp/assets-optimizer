import fs from "node:fs/promises"
import type { AiClassification } from "./AiClassification.js"
import type { AiLabelOptions } from "./AiLabelOptions.js"
import { aiLabelAssetResolve } from "./aiLabelAssetResolve.js"

export async function aiLabelAssetLoad(
  classification: AiClassification,
  options: Pick<Required<AiLabelOptions>, "simpleColor" | "visual" | "opacity">,
): Promise<Buffer> {
  return await fs.readFile(aiLabelAssetResolve(classification, options))
}
