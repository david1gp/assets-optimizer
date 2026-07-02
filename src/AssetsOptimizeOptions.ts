export interface AssetsOptimizeOptions {
  cwd?: string
  logLevel?: 0 | 1 | 2 | 3
  processImages?: boolean
  imageOriginalsDir?: string
  imageOptimizedDir?: string
  // Optimize loose image files sitting directly at the root of imageOriginalsDir
  // (i.e. not inside a WxH transform folder). Each is emitted once at its native
  // dimensions, format derived from its extension. Off by default: root files are
  // skipped so only transform-folder images are processed.
  allowRootImageFiles?: boolean
  imageHashLength?: number
  ignoredDirNames?: readonly string[]
  // Source dirs to scope image re-encoding to (absolute, or relative to cwd).
  // When set, only images under these dirs are (re)optimized and stale-deletion
  // is skipped; the generated image list still scans the full optimized dir so
  // it stays complete. Empty/undefined processes everything (default).
  imageFilterDirs?: readonly string[]
  imageTypeImportPath?: string
  imageListOutputPath?: string
  generateImageList?: boolean
  processVideos?: boolean
  videoOriginalsDir?: string
  videoOptimizedDir?: string
  videoListOutputPath?: string
  generateVideoList?: boolean
  videoPreviewQuality?: number
  videoPreviewHashLength?: number
  processFonts?: boolean
  fontOriginalsDir?: string
  fontOptimizedDir?: string
  fontListOutputPath?: string
  generateFontList?: boolean
}
