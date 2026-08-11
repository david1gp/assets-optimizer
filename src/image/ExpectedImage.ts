import type { AiClassification } from "./AiClassification.js"

export interface ExpectedImage {
  localPath: string
  fileName: string
  aiClassification?: AiClassification
}
