import type { AssetsOptimizeOptions } from "../AssetsOptimizeOptions.js"

export interface ProcessAssetsOptions extends AssetsOptimizeOptions {
  sourceImagesRemotePath: string
  sourceVideosRemotePath: string
  sourceFontsRemotePath: string
  destImagesRemotePath: string
  destVideosRemotePath: string
  destFontsRemotePath: string
  cwd?: string
  resync?: boolean
  processImages?: boolean
  processVideos?: boolean
  processFonts?: boolean
  imageOriginalsDir?: string
  imageOptimizedDir?: string
  videoOriginalsDir?: string
  videoOptimizedDir?: string
  fontOriginalsDir?: string
  fontOptimizedDir?: string
  imageListOutputPath?: string
  videoListOutputPath?: string
  fontListOutputPath?: string
  assetsOptimizeLocallyFn?: () => Promise<void>
  imageCacheControl?: string
  videoCacheControl?: string
  fontCacheControl?: string
}