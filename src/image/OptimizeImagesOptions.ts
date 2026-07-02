export interface OptimizeImagesOptions {
  cwd?: string
  logLevel?: 0 | 1 | 2 | 3
  imageOriginalsDir?: string
  imageOptimizedDir?: string
  // Optimize loose image files at the root of imageOriginalsDir (outside any WxH
  // transform folder), each at its native dimensions. Off by default.
  allowRootImageFiles?: boolean
  imageHashLength?: number
  ignoredDirNames?: readonly string[]
  // Source dirs (absolute, or relative to cwd) to scope re-encoding to. When set,
  // only images under these dirs are (re)optimized and stale-deletion is skipped,
  // leaving all other optimized files untouched. The image list still scans the
  // full optimized dir, so it stays complete.
  imageFilterDirs?: readonly string[]
  imageTypeImportPath?: string
  imageListOutputPath?: string
  generateImageList?: boolean
}
