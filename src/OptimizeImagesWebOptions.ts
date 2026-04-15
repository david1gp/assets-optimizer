export interface OptimizeImagesWebOptions {
  cwd?: string
  projectName?: string
  imageOriginalsDir?: string
  imageOptimizedDir?: string
  videosDir?: string
  processedVideosDir?: string
  rcloneRemote?: string
  remoteImageOriginalsDir?: string
  remoteImageOptimizedDir?: string
  remoteVideoOriginalsDir?: string
  remoteVideoProcessedDir?: string
  cacheControlHeader?: string
}
