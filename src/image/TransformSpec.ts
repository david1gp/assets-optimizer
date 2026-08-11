import type { AiClassification } from "./AiClassification.js"
import type { ImageFormat } from "./ImageFormat.js"

export interface TransformSpec {
  width: number
  height: number
  format: ImageFormat
  aiClassification?: AiClassification
  normalized: string
}
