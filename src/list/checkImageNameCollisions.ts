import path from "node:path"
import { walkFiles } from "../shared/walkFiles.js"
import { getAssetKey } from "./getAssetKey.js"

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".tiff", ".svg"])

export interface ImageNameCollision {
  key: string
  paths: string[]
}

export async function checkImageNameCollisions(directory: string, hashLength = 8): Promise<ImageNameCollision[]> {
  const pathsByKey = new Map<string, string[]>()

  for (const filePath of await walkFiles(directory)) {
    const extension = path.extname(filePath).toLowerCase()
    if (!IMAGE_EXTENSIONS.has(extension)) {
      continue
    }

    const key = normalizeGeneratedImageKey(getAssetKey(filePath), hashLength)
    const relativePath = path.relative(directory, filePath)
    pathsByKey.set(key, [...(pathsByKey.get(key) ?? []), relativePath])
  }

  return [...pathsByKey.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([key, paths]) => ({
      key,
      paths: paths.toSorted(),
    }))
    .toSorted((a, b) => a.key.localeCompare(b.key))
}

function normalizeGeneratedImageKey(key: string, hashLength: number): string {
  return key.replace(new RegExp(`_[0-9a-f]{${hashLength}}$`, "i"), "")
}
