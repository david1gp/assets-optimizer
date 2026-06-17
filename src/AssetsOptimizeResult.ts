export interface AssetsOptimizeResult {
  processed: string[]
  skippedExisting: string[]
  warnings: string[]
  deletedLocal: string[]
  processedFonts: string[]
  skippedExistingFonts: string[]
  processedVideos: string[]
  skippedExistingVideos: string[]
  processedVideoPreviews: string[]
  skippedExistingVideoPreviews: string[]
}
