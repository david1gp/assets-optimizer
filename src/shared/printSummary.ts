import type { OptimizeImagesWebResult } from "../OptimizeImagesWebResult.js"

export function printSummary(result: OptimizeImagesWebResult): void {
  console.log(`Processed ${result.processed.length} new optimized images`)
  if (result.processed.length > 0) {
    for (const fileName of result.processed) {
      console.log(`+ ${fileName}`)
    }
  }

  console.log(`Skipped ${result.skippedExisting.length} existing optimized images`)
  console.log(`Skipped ${result.skippedRootFiles.length} root original files`)
  console.log(`Deleted ${result.deletedLocal.length} stale local optimized images`)
  console.log(`Uploaded ${result.uploadedRemote.length} optimized images to R2`)
  console.log(`Deleted ${result.deletedRemote.length} stale remote optimized images`)
  console.log(`Processed ${result.processedVideos.length} new optimized videos`)
  console.log(`Skipped ${result.skippedExistingVideos.length} existing processed videos`)
  console.log(`Uploaded ${result.uploadedRemoteVideos.length} processed videos to R2`)
}
