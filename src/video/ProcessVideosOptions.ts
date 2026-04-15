import type { OptimizeImagesWebResult } from "../OptimizeImagesWebResult.js"

export interface ProcessVideosOptions {
  cwd: string
  videosDir: string
  processedVideosDir: string
  remoteVideoOriginals: string
  remoteVideoProcessed: string
  cacheControlHeader: string
  result: OptimizeImagesWebResult
}
