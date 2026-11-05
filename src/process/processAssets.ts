import { assetsOptimize } from "../assetsOptimize.js"
import { runRclone } from "../rclone/runRclone.js"
import { runRcloneCapture } from "../rclone/runRcloneCapture.js"
import { syncOriginals } from "../sync/syncOriginals.js"
import type { ProcessAssetsOptions } from "./ProcessAssetsOptions.js"

export async function processAssets(options: ProcessAssetsOptions): Promise<void> {
  const {
    sourceImagesRemotePath,
    sourceVideosRemotePath,
    sourceFontsRemotePath,
    destImagesRemotePath,
    destVideosRemotePath,
    destFontsRemotePath,
    cwd = process.cwd(),
    resync: _resync,
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
    videoPreviewCacheControl = "Cache-Control:public, max-age=31536000, immutable",
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

  if (processImages) await syncOriginals({ localDir: imageOriginalsDir, remotePath: sourceImages, cwd, logLevel })
  if (processVideos) await syncOriginals({ localDir: videoOriginalsDir, remotePath: sourceVideos, cwd, logLevel })
  if (processFonts) await syncOriginals({ localDir: fontOriginalsDir, remotePath: sourceFonts, cwd, logLevel })

  if (processImages) await pullOutputs(destImages, imageOptimizedDir, cwd)
  if (processVideos) await pullOutputs(destVideos, videoOptimizedDir, cwd)
  if (processFonts) await pullOutputs(destFonts, fontOptimizedDir, cwd)

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

  if (processImages) {
    if ((logLevel ?? 3) >= 2) console.log(`Uploading optimized images: ${imageOptimizedDir} -> ${destImages}`)
    await runRclone(["sync", imageOptimizedDir, destImages, "--header-upload", imageCacheControl], cwd)
  }

  if (processVideos) {
    if ((logLevel ?? 3) >= 2) console.log(`Uploading optimized videos: ${videoOptimizedDir} -> ${destVideos}`)
    // Videos keep stable, unhashed filenames (optimized by hand), so they get a short cache.
    // Their hashed preview images are excluded here and uploaded separately with a long cache.
    await runRclone(
      ["sync", videoOptimizedDir, destVideos, "--header-upload", videoCacheControl, "--exclude", "*.webp"],
      cwd,
    )
    // Hashed video preview images are content-addressed, so they can be cached immutably.
    await runRclone(
      ["sync", videoOptimizedDir, destVideos, "--header-upload", videoPreviewCacheControl, "--include", "*.webp"],
      cwd,
    )
  }

  if (processFonts) {
    if ((logLevel ?? 3) >= 2) console.log(`Uploading optimized fonts: ${fontOptimizedDir} -> ${destFonts}`)
    await runRclone(["sync", fontOptimizedDir, destFonts, "--header-upload", fontCacheControl], cwd)
  }
}

async function pullOutputs(remote: string, localDir: string, cwd: string): Promise<void> {
  const result = await runRcloneCapture(["lsjson", remote, "--max-depth", "1"], cwd)
  if (result.exitCode !== 0) {
    if (result.exitCode === 3 && (!result.stdout.trim() || /^\[\s*\]?$/.test(result.stdout.trim()))) return
    throw new Error(`rclone lsjson failed (${result.exitCode}): ${result.stderr}`)
  }
  await runRclone(["copy", remote, localDir, "--update"], cwd)
}
