import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import type { Logger } from "../shared/logger.js"

export interface ProcessImagesOptions {
  imageOriginalsDir: string
  imageOptimizedDir: string
  hashLength?: number
  result: AssetsOptimizeResult
  logger: Logger
}
