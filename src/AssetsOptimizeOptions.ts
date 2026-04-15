export interface OptimizeImagesWebOptions {
  cwd?: string
  projectName?: string
  processImages?: boolean
  imageOriginalsDir?: string
  imageOptimizedDir?: string
  allowRootImageFiles?: boolean
  imageListOutputPath?: string
  imageListImportPath?: string
  generateImageList?: boolean
  processVideos?: boolean
  videosDir?: string
  processedVideosDir?: string
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
