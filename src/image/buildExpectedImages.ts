import fs from "node:fs/promises"
import path from "node:path"
import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import { walkFiles } from "../shared/walkFiles.js"
import { createOutputHash } from "./createOutputHash.js"
import { createRootImageTransform } from "./createRootImageTransform.js"
import { type ExpectedImage } from "./ExpectedImage.js"
import { parseTransformSpec } from "./parseTransformSpec.js"
import { processImage } from "./processImage.js"
import { supportedSourceExtensions } from "./supportedSourceExtensions.js"
import type { TransformSpec } from "./TransformSpec.js"

export async function buildExpectedImages(
  originalsDir: string,
  optimizedDir: string,
  result: AssetsOptimizeResult,
  allowRootImageFiles = false,
  hashLength = 8,
): Promise<ExpectedImage[]> {
  const expectedImages: ExpectedImage[] = []

  await collectFromDir(originalsDir, true)

  return expectedImages

  async function collectFromDir(dir: string, isRoot: boolean): Promise<void> {
    const dirEntries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of dirEntries) {
      const entryPath = path.join(dir, entry.name)

      if (entry.isFile()) {
        await handleLooseFile(entryPath, entry.name, isRoot)
        continue
      }

      if (!entry.isDirectory()) {
        continue
      }

      const transform = parseTransformSpec(entry.name)
      if (transform) {
        await handleTransformDir(entryPath, transform)
        continue
      }

      // Not a transform folder: treat it as a logical grouping directory and
      // recurse so transform folders can live in subdirs of the originals dir.
      await collectFromDir(entryPath, false)
    }
  }

  async function handleLooseFile(entryPath: string, name: string, isRoot: boolean): Promise<void> {
    if (!isRoot) {
      const relativeName = path.relative(originalsDir, entryPath)
      result.warnings.push(`Skipped file outside transform folder: ${relativeName}`)
      console.warn(`Skipped file outside transform folder: ${relativeName}`)
      return
    }

    if (!allowRootImageFiles) {
      result.skippedRootFiles.push(name)
      result.warnings.push(`Skipped root original file: ${name}`)
      console.warn(`Skipped root original file: ${name}`)
      return
    }

    const extension = path.extname(name).toLowerCase()
    if (!supportedSourceExtensions.has(extension)) {
      result.warnings.push(`Skipped unsupported root source file: ${name}`)
      console.warn(`Skipped unsupported root source file: ${name}`)
      return
    }

    const sourceBuffer = await fs.readFile(entryPath)
    const transform = createRootImageTransform(entryPath, sourceBuffer)
    if (!transform) {
      result.warnings.push(`Skipped root source file with unsupported output format: ${name}`)
      console.warn(`Skipped root source file with unsupported output format: ${name}`)
      return
    }

    await emitImage(sourceBuffer, entryPath, transform)
  }

  async function handleTransformDir(transformDir: string, transform: TransformSpec): Promise<void> {
    for (const sourceFile of await walkFiles(transformDir)) {
      const extension = path.extname(sourceFile).toLowerCase()
      if (extension === ".md") {
        continue
      }

      if (!supportedSourceExtensions.has(extension)) {
        result.warnings.push(`Skipped unsupported source file: ${path.relative(originalsDir, sourceFile)}`)
        console.warn(`Skipped unsupported source file: ${path.relative(originalsDir, sourceFile)}`)
        continue
      }

      const sourceBuffer = await fs.readFile(sourceFile)
      await emitImage(sourceBuffer, sourceFile, transform)
    }
  }

  async function emitImage(sourceBuffer: Buffer, sourceFile: string, transform: TransformSpec): Promise<void> {
    if (sourceBuffer.length === 0) {
      result.warnings.push(`Skipped empty source file: ${path.relative(originalsDir, sourceFile)}`)
      console.warn(`Skipped empty source file: ${path.relative(originalsDir, sourceFile)}`)
      return
    }

    const hash = createOutputHash(sourceBuffer, transform.normalized, hashLength)
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
