import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import type { Logger } from "../shared/logger.js"

export interface ProcessImagesOptions {
  imageOriginalsDir: string
  imageOptimizedDir: string
  // Optimize loose image files at the root of imageOriginalsDir; off by default.
  allowRootImageFiles?: boolean
  hashLength?: number
  ignoredDirNames?: readonly string[]
  // Absolute source dirs to scope re-encoding to; empty/undefined means process all.
  imageFilterDirs?: readonly string[]
  result: AssetsOptimizeResult
  logger: Logger
}
