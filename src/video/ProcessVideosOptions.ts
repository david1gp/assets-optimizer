import type { OptimizeImagesWebResult } from "../AssetsOptimizeResult.js"

export interface ProcessVideosOptions {
  cwd: string
  videosDir: string
  processedVideosDir: string
  remoteVideoOriginals: string
  remoteVideoProcessed: string
  cacheControlHeader: string
  videoPreviewQuality: number
  result: OptimizeImagesWebResult
}
