import fs from "node:fs/promises"
import path from "node:path"
import { listLocalFiles } from "../shared/listLocalFiles.js"
import { buildExpectedImages } from "./buildExpectedImages.js"
import type { ProcessImagesOptions } from "./ProcessImagesOptions.js"

export async function processImages(options: ProcessImagesOptions): Promise<void> {
  const { hashLength, ignoredDirNames, imageFilterDirs, imageOptimizedDir, imageOriginalsDir, result } = options

  await fs.mkdir(imageOriginalsDir, { recursive: true })
  await fs.mkdir(imageOptimizedDir, { recursive: true })

  const expectedImages = await buildExpectedImages(
    imageOriginalsDir,
    imageOptimizedDir,
    result,
    hashLength,
    ignoredDirNames,
    imageFilterDirs,
  )

  // While filtering we only built a partial expected set (just the in-scope
  // dirs), so the stale-deletion pass would wrongly delete every untouched
  // output. Skip it entirely — the goal is to leave all other files alone.
  if (imageFilterDirs && imageFilterDirs.length > 0) {
    return
  }

  const expectedFileNames = new Set(expectedImages.map((image) => image.fileName))

  const localOptimizedFiles = await listLocalFiles(imageOptimizedDir, ignoredDirNames)
  for (const localFile of localOptimizedFiles) {
    const relativeFile = path.relative(imageOptimizedDir, localFile)
    if (!expectedFileNames.has(relativeFile) && !relativeFile.startsWith(".")) {
      await fs.rm(localFile, { force: true })
      result.deletedLocal.push(relativeFile)
    }
  }
}
