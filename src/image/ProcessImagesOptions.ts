import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import type { Logger } from "../shared/logger.js"

export interface ProcessImagesOptions {
  cwd: string
  imageOriginalsDir: string
  imageOptimizedDir: string
  allowRootImageFiles: boolean
  remoteImageOriginals?: string
  remoteImageOptimized?: string
  cacheControlHeader: string
  result: AssetsOptimizeResult
  logger: Logger
}
