import fs from "node:fs/promises"
import path from "node:path"
import type { OptimizeImagesWebResult } from "../OptimizeImagesWebResult.js"
import { walkFiles } from "../shared/walkFiles.js"
import { createOutputHash } from "./createOutputHash.js"
import { type ExpectedImage } from "./ExpectedImage.js"
import { parseTransformSpec } from "./parseTransformSpec.js"
import { processImage } from "./processImage.js"
import { supportedSourceExtensions } from "./supportedSourceExtensions.js"

export async function buildExpectedImages(
  originalsDir: string,
  optimizedDir: string,
  result: OptimizeImagesWebResult,
): Promise<ExpectedImage[]> {
  const dirEntries = await fs.readdir(originalsDir, { withFileTypes: true })
  const expectedImages: ExpectedImage[] = []

  for (const entry of dirEntries) {
    const entryPath = path.join(originalsDir, entry.name)
    if (entry.isFile()) {
      result.skippedRootFiles.push(entry.name)
      result.warnings.push(`Skipped root original file: ${entry.name}`)
      console.warn(`Skipped root original file: ${entry.name}`)
      continue
    }

    if (!entry.isDirectory()) {
      continue
    }

    const transform = parseTransformSpec(entry.name)
    if (!transform) {
      result.warnings.push(`Skipped folder with invalid transform name: ${entry.name}`)
      console.warn(`Skipped folder with invalid transform name: ${entry.name}`)
      continue
    }

    for (const sourceFile of await walkFiles(entryPath)) {
      const extension = path.extname(sourceFile).toLowerCase()
      if (!supportedSourceExtensions.has(extension)) {
        result.warnings.push(`Skipped unsupported source file: ${path.relative(originalsDir, sourceFile)}`)
        console.warn(`Skipped unsupported source file: ${path.relative(originalsDir, sourceFile)}`)
        continue
      }
      const sourceBuffer = await fs.readFile(sourceFile)
      const hash = createOutputHash(sourceBuffer, transform.normalized)
      const baseName = path.parse(sourceFile).name
      const fileName = `${baseName}_${hash}.${transform.format}`
      const outputPath = path.join(optimizedDir, fileName)

      expectedImages.push({
        fileName,
        localPath: outputPath,
      })

      try {
        await fs.access(outputPath)
        result.skippedExisting.push(fileName)
      } catch {
        await processImage(sourceBuffer, outputPath, transform)
        result.processed.push(fileName)
      }
    }
  }

  return expectedImages
}
