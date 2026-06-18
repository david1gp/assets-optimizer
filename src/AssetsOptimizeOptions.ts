export interface AssetsOptimizeOptions {
  cwd?: string
  logLevel?: 0 | 1 | 2 | 3
  processImages?: boolean
  imageOriginalsDir?: string
  imageOptimizedDir?: string
  imageHashLength?: number
  ignoredDirNames?: readonly string[]
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
