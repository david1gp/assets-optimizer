import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import type { Logger } from "../shared/logger.js"

export interface ProcessVideosOptions {
  cwd: string
  videoOriginalsDir: string
  videoOptimizedDir: string
  videoPreviewQuality: number
  videoPreviewHashLength: number
  result: AssetsOptimizeResult
  logger: Logger
}
