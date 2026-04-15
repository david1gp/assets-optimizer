import type { OptimizeImagesWebResult } from "../OptimizeImagesWebResult.js"

export interface ProcessImagesOptions {
  cwd: string
  imageOriginalsDir: string
  imageOptimizedDir: string
  remoteImageOriginals: string
  remoteImageOptimized: string
  cacheControlHeader: string
  result: OptimizeImagesWebResult
}
