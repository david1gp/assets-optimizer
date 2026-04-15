import type { OptimizeImagesWebResult } from "../AssetsOptimizeResult.js"

export interface ProcessImagesOptions {
  cwd: string
  imageOriginalsDir: string
  imageOptimizedDir: string
  allowRootImageFiles: boolean
  remoteImageOriginals: string
  remoteImageOptimized: string
  cacheControlHeader: string
  result: OptimizeImagesWebResult
}
