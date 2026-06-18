export interface OptimizeImagesOptions {
  cwd?: string
  logLevel?: 0 | 1 | 2 | 3
  imageOriginalsDir?: string
  imageOptimizedDir?: string
  imageHashLength?: number
  ignoredDirNames?: readonly string[]
  imageTypeImportPath?: string
  imageListOutputPath?: string
  generateImageList?: boolean
}
