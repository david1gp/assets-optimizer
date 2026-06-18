import fs from "node:fs/promises"
import path from "node:path"
import { imageSize } from "image-size"
import { parseTransformSpec } from "../image/parseTransformSpec.js"
import { getOwnPackageName } from "../shared/getOwnPackageName.js"
import { isIgnoredDir } from "../shared/isIgnoredDir.js"
import type { Logger } from "../shared/logger.js"
import { walkFiles } from "../shared/walkFiles.js"
import type { ImageType } from "./AssetListTypes.js"
import { formatGeneratedCodeFile } from "./formatGeneratedCodeFile.js"
import { getAssetKey } from "./getAssetKey.js"
import { loadExistingAssetList } from "./loadExistingAssetList.js"
import { sortAssetMap } from "./sortAssetMap.js"

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".tiff", ".svg"])
const IMAGE_ALT_EXTENSIONS = new Set([".txt", ".md"])

export async function generateImageList(
  imageDirectory: string,
  outputPath: string,
  imageTypeImportPath?: string,
  logger?: Logger,
  altTextDirectory?: string,
  hashLength = 8,
  ignoredDirNames: readonly string[] = [],
): Promise<void> {
  const resolvedImageTypeImportPath = imageTypeImportPath ?? (await getOwnPackageName(import.meta.url))
  const existingImages = await loadExistingAssetList<ImageType>(outputPath, "imageList")
  const imageAlts = altTextDirectory ? await loadImageAlts(altTextDirectory, hashLength, logger, ignoredDirNames) : {}
  const imageMap = await processImageFiles(
    imageDirectory,
    existingImages,
    imageAlts,
    hashLength,
    logger,
    ignoredDirNames,
  )
  const sorted = sortAssetMap(imageMap)

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await Bun.write(outputPath, createGeneratedImageListContent(sorted, resolvedImageTypeImportPath))
  await formatGeneratedCodeFile(outputPath, logger)
  logger?.files(`generated image list: ${outputPath}`)
  logger?.summary(`Generated ${Object.keys(sorted).length} images to ${outputPath}`)
}

async function processImageFiles(
  directory: string,
  existingImages: Record<string, ImageType>,
  imageAlts: Record<string, string>,
  hashLength: number,
  logger?: Logger,
  ignoredDirNames: readonly string[] = [],
): Promise<Record<string, ImageType>> {
  const imageMap: Record<string, ImageType> = {}

  for (const filePath of await walkFiles(directory, ignoredDirNames)) {
    const extension = path.extname(filePath).toLowerCase()
    if (!IMAGE_EXTENSIONS.has(extension)) {
      continue
    }

    try {
      const buffer = await fs.readFile(filePath)
      const dimensions = imageSize(buffer)
      if (!dimensions.width || !dimensions.height) {
        continue
      }

      const relativePath = path.relative(directory, filePath)
      const key = normalizeGeneratedImageKey(getAssetKey(filePath), hashLength)
      const fileName = path.basename(filePath, extension)

      if (imageMap[key]) {
        logger?.warn(
          `Duplicate image key "${key}": ${relativePath} overwrites ${imageMap[key].path} (rename one source)`,
        )
      }

      imageMap[key] = {
        path: relativePath,
        width: dimensions.width,
        height: dimensions.height,
        alt: imageAlts[key] || existingImages[key]?.alt || formatGeneratedImageAlt(fileName, hashLength),
        mimeType: getImageMimeType(extension),
      }
    } catch (error) {
      logger?.error(`Error processing ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return imageMap
}

async function loadImageAlts(
  directory: string,
  hashLength: number,
  logger?: Logger,
  ignoredDirNames: readonly string[] = [],
): Promise<Record<string, string>> {
  const imageAlts: Record<string, string> = {}

  for (const filePath of await collectTransformAltFiles(directory, ignoredDirNames)) {
    await loadImageAlt(filePath, imageAlts, hashLength, logger)
  }

  return imageAlts
}

async function collectTransformAltFiles(directory: string, ignoredDirNames: readonly string[] = []): Promise<string[]> {
  const files: string[] = []
  await collectFromDir(directory, false)
  return files.sort((a, b) => path.extname(a).localeCompare(path.extname(b)))

  async function collectFromDir(dir: string, inTransform: boolean): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)

      if (entry.isFile()) {
        if (inTransform && IMAGE_ALT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          files.push(entryPath)
        }
        continue
      }

      if (!entry.isDirectory()) {
        continue
      }

      if (isIgnoredDir(entry.name, ignoredDirNames)) {
        continue
      }

      const transform = parseTransformSpec(entry.name)
      if (inTransform && transform) {
        continue
      }

      await collectFromDir(entryPath, inTransform || transform !== null)
    }
  }
}

async function loadImageAlt(
  filePath: string,
  imageAlts: Record<string, string>,
  hashLength: number,
  logger?: Logger,
): Promise<void> {
  try {
    const key = normalizeGeneratedImageKey(getAssetKey(filePath), hashLength)
    const alt = formatMarkdownAlt(await fs.readFile(filePath, "utf-8"))
    if (alt) {
      imageAlts[key] = alt
    }
  } catch (error) {
    logger?.error(`Error reading image alt ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function normalizeGeneratedImageKey(key: string, hashLength: number): string {
  return key.replace(new RegExp(`_[0-9a-f]{${hashLength}}$`, "i"), "")
}

function formatGeneratedImageAlt(fileName: string, hashLength: number): string {
  return normalizeGeneratedImageKey(fileName, hashLength).replace(/[-_]/g, " ")
}

function formatMarkdownAlt(content: string): string {
  return content.replace(/\s+/g, " ").trim()
}

function createGeneratedImageListContent(imageMap: Record<string, ImageType>, imageTypeImportPath: string): string {
  return `import type { ImageType } from "${imageTypeImportPath}"

// Auto-generated, manual changes will be lost, generated by optimizeAssets from @adaptive-ds/assets-optimizer
export const imageList = ${JSON.stringify(imageMap, null, 2)} as const satisfies Record<string, ImageType>
`
}

function getImageMimeType(extension: string): string {
  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".png":
      return "image/png"
    case ".gif":
      return "image/gif"
    case ".webp":
      return "image/webp"
    case ".avif":
      return "image/avif"
    case ".tiff":
      return "image/tiff"
    case ".svg":
      return "image/svg+xml"
    default:
      return "application/octet-stream"
  }
}
