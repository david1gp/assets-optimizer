import fs from "node:fs/promises"
import path from "node:path"
import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import { isIgnoredDir } from "../shared/isIgnoredDir.js"
import { createOutputHash } from "./createOutputHash.js"
import { createRootImageTransform } from "./createRootImageTransform.js"
import { type ExpectedImage } from "./ExpectedImage.js"
import { parseTransformSpec } from "./parseTransformSpec.js"
import { processImage } from "./processImage.js"
import { supportedSourceExtensions } from "./supportedSourceExtensions.js"
import type { TransformSpec } from "./TransformSpec.js"

const IMAGE_ALT_EXTENSIONS = new Set([".txt", ".md"])

export async function buildExpectedImages(
  originalsDir: string,
  optimizedDir: string,
  result: AssetsOptimizeResult,
  hashLength = 8,
  ignoredDirNames: readonly string[] = [],
  filterDirs: readonly string[] = [],
  allowRootImageFiles = false,
): Promise<ExpectedImage[]> {
  const expectedImages: ExpectedImage[] = []

  // When filterDirs is set we only encode source files living under one of them,
  // leaving every other image untouched. Directory traversal stays cheap; the
  // expensive read+hash+encode is what we skip for out-of-scope files.
  const isInFilter = (sourceFile: string): boolean =>
    filterDirs.length === 0 || filterDirs.some((dir) => sourceFile === dir || sourceFile.startsWith(dir + path.sep))

  await collectFromDir(originalsDir)

  return expectedImages

  async function collectFromDir(dir: string): Promise<void> {
    const dirEntries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of dirEntries) {
      const entryPath = path.join(dir, entry.name)

      if (entry.isFile()) {
        // Loose files only carry a transform at the originals root (opt-in);
        // inside grouping dirs they're always skipped, as before.
        if (dir === originalsDir) {
          await handleRootFile(entryPath, entry.name)
        }
        continue
      }

      if (!entry.isDirectory()) {
        continue
      }

      // Silently skip ignored folders so their contents are never reported.
      if (isIgnoredDir(entry.name, ignoredDirNames)) {
        continue
      }

      const transform = parseTransformSpec(entry.name)
      if (transform) {
        await handleTransformDir(entryPath, transform)
        continue
      }

      // Not a transform folder: treat it as a logical grouping directory and
      // recurse so transform folders can live in subdirs of the originals dir.
      await collectFromDir(entryPath)
    }
  }

  async function handleTransformDir(transformDir: string, transform: TransformSpec): Promise<void> {
    for (const sourceFile of await collectTransformFiles(transformDir, transformDir)) {
      // Out-of-scope file: leave its optimized output exactly as-is (no encode,
      // and not added to expectedImages so the deletion pass — which is itself
      // skipped while filtering — never considers it).
      if (!isInFilter(sourceFile)) {
        continue
      }

      const extension = path.extname(sourceFile).toLowerCase()
      if (IMAGE_ALT_EXTENSIONS.has(extension)) {
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

  async function handleRootFile(entryPath: string, name: string): Promise<void> {
    const extension = path.extname(name).toLowerCase()

    // Alt sidecars are consumed by the image-list generator, not encoded here.
    if (IMAGE_ALT_EXTENSIONS.has(extension)) {
      return
    }

    if (!allowRootImageFiles) {
      result.skippedRootFiles.push(name)
      result.warnings.push(`Skipped root original file (allowRootImageFiles is off): ${name}`)
      console.warn(`Skipped root original file (allowRootImageFiles is off): ${name}`)
      return
    }

    // Respect filter scoping: an out-of-scope root file is left exactly as-is.
    if (!isInFilter(entryPath)) {
      return
    }

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

  async function collectTransformFiles(dir: string, transformDir: string): Promise<string[]> {
    const dirEntries = await fs.readdir(dir, { withFileTypes: true })
    const files: string[] = []

    for (const entry of dirEntries) {
      const entryPath = path.join(dir, entry.name)

      if (entry.isFile()) {
        files.push(entryPath)
        continue
      }

      if (!entry.isDirectory()) {
        continue
      }

      if (isIgnoredDir(entry.name, ignoredDirNames)) {
        continue
      }

      const nestedTransform = parseTransformSpec(entry.name)
      if (nestedTransform) {
        const relativePath = path.relative(originalsDir, entryPath)
        const parentTransform = path.relative(originalsDir, transformDir)
        result.warnings.push(`Skipped nested transform folder: ${relativePath} is inside ${parentTransform}`)
        console.warn(`Skipped nested transform folder: ${relativePath} is inside ${parentTransform}`)
        continue
      }

      files.push(...(await collectTransformFiles(entryPath, transformDir)))
    }

    return files
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
