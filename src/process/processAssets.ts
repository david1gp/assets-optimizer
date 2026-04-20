import { assetsOptimize } from "../assetsOptimize.js"
import { bisync } from "../rclone/bisync.js"
import { runRclone } from "../rclone/runRclone.js"
import type { ProcessAssetsOptions } from "./ProcessAssetsOptions.js"
import { shouldBisync } from "./utils/shouldBisync.js"

export async function processAssets(options: ProcessAssetsOptions): Promise<void> {
  const {
    sourceImagesRemotePath,
    sourceVideosRemotePath,
    sourceFontsRemotePath,
    destImagesRemotePath,
    destVideosRemotePath,
    destFontsRemotePath,
    cwd = process.cwd(),
    resync = false,
    processImages = true,
    processVideos = true,
    processFonts = true,
    imageOriginalsDir = "./images",
    imageOptimizedDir = "./public/images",
    videoOriginalsDir = "./videos",
    videoOptimizedDir = "./public/videos",
    fontOriginalsDir = "./fonts",
    fontOptimizedDir = "./public/fonts",
    imageListOutputPath = "./src/app/assets/imageList.ts",
    videoListOutputPath = "./src/app/assets/videoList.ts",
    fontListOutputPath = "./src/app/assets/fontList.ts",
    assetsOptimizeLocallyFn,
    imageCacheControl = "Cache-Control:public, max-age=31536000, immutable",
    videoCacheControl = "Cache-Control:public, max-age=259200, immutable",
    fontCacheControl = "Cache-Control:public, max-age=31536000, immutable",
    logLevel,
    ...assetsOptimizeOptions
  } = options

  if (!processImages && !processVideos && !processFonts) {
    if ((logLevel ?? 3) >= 2) console.log("Nothing to process (images, videos, and fonts disabled)")
    return
  }

  const sourceImages = sourceImagesRemotePath
  const sourceVideos = sourceVideosRemotePath
  const sourceFonts = sourceFontsRemotePath
  const destImages = destImagesRemotePath
  const destVideos = destVideosRemotePath
  const destFonts = destFontsRemotePath

  const syncImages = processImages ? await shouldBisync(imageOriginalsDir, sourceImages) : false
  const syncVideos = processVideos ? await shouldBisync(videoOriginalsDir, sourceVideos) : false
  const syncFonts = processFonts ? await shouldBisync(fontOriginalsDir, sourceFonts) : false

  if (!syncImages && !syncVideos && !syncFonts) {
    if ((logLevel ?? 3) >= 2) console.log("No sync needed (local and remote both empty)")
    return
  }

  if (syncImages) {
    if ((logLevel ?? 3) >= 2) console.log(`Syncing images: ${imageOriginalsDir} <-> ${sourceImages}`)
    await bisync(imageOriginalsDir, sourceImages, { cwd, resync })
  }

  if (syncVideos) {
    if ((logLevel ?? 3) >= 2) console.log(`Syncing videos: ${videoOriginalsDir} <-> ${sourceVideos}`)
    await bisync(videoOriginalsDir, sourceVideos, { cwd, resync })
  }

  if (syncFonts) {
    if ((logLevel ?? 3) >= 2) console.log(`Syncing fonts: ${fontOriginalsDir} <-> ${sourceFonts}`)
    await bisync(fontOriginalsDir, sourceFonts, { cwd, resync })
  }

  if (assetsOptimizeLocallyFn) {
    if ((logLevel ?? 3) >= 2) console.log("Running custom assetsOptimizeLocallyFn")
    await assetsOptimizeLocallyFn()
  } else {
    if ((logLevel ?? 3) >= 2) console.log("Running default assetsOptimize")
    await assetsOptimize({
      cwd,
      logLevel: logLevel ?? 3,
      processImages,
      processVideos,
      processFonts,
      imageOriginalsDir,
      imageOptimizedDir,
      imageListOutputPath,
      videoOriginalsDir,
      videoOptimizedDir,
      videoListOutputPath,
      fontOriginalsDir,
      fontOptimizedDir,
      fontListOutputPath,
      ...assetsOptimizeOptions,
    })
  }

  if (syncImages) {
    if ((logLevel ?? 3) >= 2) console.log(`Uploading optimized images: ${imageOptimizedDir} -> ${destImages}`)
    await runRclone(["sync", imageOptimizedDir, destImages, "--header-upload", imageCacheControl], cwd)
  }

  if (syncVideos) {
    if ((logLevel ?? 3) >= 2) console.log(`Uploading optimized videos: ${videoOptimizedDir} -> ${destVideos}`)
    await runRclone(["sync", videoOptimizedDir, destVideos, "--header-upload", videoCacheControl], cwd)
  }

  if (syncFonts) {
    if ((logLevel ?? 3) >= 2) console.log(`Uploading optimized fonts: ${fontOptimizedDir} -> ${destFonts}`)
    await runRclone(["sync", fontOptimizedDir, destFonts, "--header-upload", fontCacheControl], cwd)
  }
}
