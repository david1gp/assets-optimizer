export interface AssetsOptimizeOptions {
  cwd?: string
  projectName?: string
  logLevel?: 0 | 1 | 2 | 3
  processImages?: boolean
  imageOriginalsDir?: string
  imageOptimizedDir?: string
  allowRootImageFiles?: boolean
  imageListOutputPath?: string
  imageListImportPath?: string
  generateImageList?: boolean
  processVideos?: boolean
  videoOriginalsDir?: string
  videoOptimizedDir?: string
  videoListOutputPath?: string
  videoListImportPath?: string
  generateVideoList?: boolean
  videoPreviewQuality?: number
  rcloneRemote?: string
  remoteImageOriginalsDir?: string
  remoteImageOptimizedDir?: string
  remoteVideoOriginalsDir?: string
  remoteVideoProcessedDir?: string
  cacheControlHeader?: string
}
