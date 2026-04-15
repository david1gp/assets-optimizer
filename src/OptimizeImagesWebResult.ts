export interface OptimizeImagesWebResult {
  processed: string[]
  skippedExisting: string[]
  skippedRootFiles: string[]
  warnings: string[]
  deletedLocal: string[]
  uploadedRemote: string[]
  deletedRemote: string[]
  processedVideos: string[]
  skippedExistingVideos: string[]
  uploadedRemoteVideos: string[]
}
