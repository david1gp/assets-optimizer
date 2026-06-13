import fs from "node:fs/promises"
import path from "node:path"
import { listLocalFiles } from "../shared/listLocalFiles.js"
import { buildExpectedImages } from "./buildExpectedImages.js"
import type { ProcessImagesOptions } from "./ProcessImagesOptions.js"

export async function processImages(options: ProcessImagesOptions): Promise<void> {
  const { allowRootImageFiles, hashLength, imageOptimizedDir, imageOriginalsDir, result } = options

  await fs.mkdir(imageOriginalsDir, { recursive: true })
  await fs.mkdir(imageOptimizedDir, { recursive: true })

  const expectedImages = await buildExpectedImages(
    imageOriginalsDir,
    imageOptimizedDir,
    result,
    allowRootImageFiles,
    hashLength,
  )
  const expectedFileNames = new Set(expectedImages.map((image) => image.fileName))

  const localOptimizedFiles = await listLocalFiles(imageOptimizedDir)
  for (const localFile of localOptimizedFiles) {
    const relativeFile = path.relative(imageOptimizedDir, localFile)
    if (!expectedFileNames.has(relativeFile) && !relativeFile.startsWith(".")) {
      await fs.rm(localFile, { force: true })
      result.deletedLocal.push(relativeFile)
    }
  }
}
