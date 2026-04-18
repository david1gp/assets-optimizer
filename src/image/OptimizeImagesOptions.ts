export interface OptimizeImagesOptions {
  cwd?: string
  logLevel?: 0 | 1 | 2 | 3
  imageOriginalsDir?: string
  imageOptimizedDir?: string
  allowRootImageFiles?: boolean
  imageListOutputPath?: string
  generateImageList?: boolean
}