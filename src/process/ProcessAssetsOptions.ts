import type { AssetsOptimizeOptions } from "../AssetsOptimizeOptions.js"

export interface ProcessAssetsOptions extends AssetsOptimizeOptions {
  sourceImagesRemotePath: string
  sourceVideosRemotePath: string
  sourceFontsRemotePath: string
  destImagesRemotePath: string
  destVideosRemotePath: string
  destFontsRemotePath: string
  cwd?: string
  /** @deprecated no-op, sync no longer needs resync */
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
  videoPreviewCacheControl?: string
  fontCacheControl?: string
}
