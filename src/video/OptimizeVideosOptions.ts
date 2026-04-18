export interface OptimizeVideosOptions {
  cwd?: string
  logLevel?: 0 | 1 | 2 | 3
  videoOriginalsDir?: string
  videoOptimizedDir?: string
  videoListOutputPath?: string
  generateVideoList?: boolean
  videoPreviewQuality?: number
}