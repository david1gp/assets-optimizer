import path from "node:path"
import type { AiClassification } from "./AiClassification.js"
import { aiClassificationParse } from "./aiClassificationParse.js"

export function aiClassificationDetect(sourcePath: string, sourceRoot: string): AiClassification | null {
  const fileName = path.basename(sourcePath)
  const fileClassification = aiClassificationParse(fileName)
  if (fileClassification) {
    return fileClassification
  }

  const relativeDirectory = path.relative(sourceRoot, path.dirname(sourcePath))
  if (
    relativeDirectory === ".." ||
    relativeDirectory.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeDirectory)
  ) {
    return null
  }

  const directoryNames = relativeDirectory ? relativeDirectory.split(path.sep).reverse() : []
  for (const directoryName of directoryNames) {
    const directoryClassification = aiClassificationParse(directoryName)
    if (directoryClassification) {
      return directoryClassification
    }
  }

  return null
}
