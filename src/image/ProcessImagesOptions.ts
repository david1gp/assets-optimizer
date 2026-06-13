import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import type { Logger } from "../shared/logger.js"

export interface ProcessImagesOptions {
  imageOriginalsDir: string
  imageOptimizedDir: string
  allowRootImageFiles: boolean
  hashLength?: number
  result: AssetsOptimizeResult
  logger: Logger
}
