import type { AiClassification } from "./AiClassification.js"

export function aiClassificationParse(value: string): AiClassification | null {
  const match = /(?:AI|Ai|ai)[\s._-](generated|modified)(?=$|[^A-Za-z])/.exec(value)
  if (!match?.[1]) {
    return null
  }

  return match[1] as AiClassification
}
