export function createVideoPreviewPath(videoPath: string): string {
  return videoPath.replace(/\.[^.]+$/, ".jpg")
}
