export interface OptimizeImagesOptions {
  cwd?: string
  logLevel?: 0 | 1 | 2 | 3
  imageOriginalsDir?: string
  imageOptimizedDir?: string
  allowRootImageFiles?: boolean
  imageHashLength?: number
  imageTypeImportPath?: string
  imageListOutputPath?: string
  generateImageList?: boolean
}
