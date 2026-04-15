import fs from "node:fs/promises"
import path from "node:path"
import { listLocalFiles } from "../shared/listLocalFiles.js"
import { listRemoteFiles } from "../shared/listRemoteFiles.js"
import { runRclone } from "../shared/runRclone.js"
import { buildExpectedImages } from "./buildExpectedImages.js"
import type { ProcessImagesOptions } from "./ProcessImagesOptions.js"

export async function processImages(options: ProcessImagesOptions): Promise<void> {
  const {
    allowRootImageFiles,
    cacheControlHeader,
    cwd,
    imageOptimizedDir,
    imageOriginalsDir,
    remoteImageOptimized,
    remoteImageOriginals,
    result,
  } = options

  await fs.mkdir(imageOriginalsDir, { recursive: true })
  await fs.mkdir(imageOptimizedDir, { recursive: true })

  await runRclone(["mkdir", remoteImageOriginals], cwd)
  await runRclone(["mkdir", remoteImageOptimized], cwd)
  await runRclone(["copy", remoteImageOriginals, imageOriginalsDir], cwd)
  await runRclone(["copy", imageOriginalsDir, remoteImageOriginals], cwd)

  const expectedImages = await buildExpectedImages(imageOriginalsDir, imageOptimizedDir, result, allowRootImageFiles)
  const expectedFileNames = new Set(expectedImages.map((image) => image.fileName))

  const localOptimizedFiles = await listLocalFiles(imageOptimizedDir)
  for (const localFile of localOptimizedFiles) {
    const relativeFile = path.relative(imageOptimizedDir, localFile)
    if (!expectedFileNames.has(relativeFile) && !relativeFile.startsWith(".")) {
      await fs.rm(localFile, { force: true })
      result.deletedLocal.push(relativeFile)
    }
  }

  const remoteOptimizedFiles = new Set(await listRemoteFiles(remoteImageOptimized, cwd))
  for (const image of expectedImages) {
    if (!remoteOptimizedFiles.has(image.fileName)) {
      await runRclone(
        [
          "copyto",
          "--header-upload",
          `Cache-Control: ${cacheControlHeader}`,
          image.localPath,
          `${remoteImageOptimized}/${image.fileName}`,
        ],
        cwd,
      )
      result.uploadedRemote.push(image.fileName)
    }
  }

  for (const remoteFile of remoteOptimizedFiles) {
    if (!expectedFileNames.has(remoteFile)) {
      await runRclone(["deletefile", `${remoteImageOptimized}/${remoteFile}`], cwd)
      result.deletedRemote.push(remoteFile)
    }
  }
}
