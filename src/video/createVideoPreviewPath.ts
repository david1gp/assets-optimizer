import path from "node:path"

/**
 * Hashed preview image path beside a video: `<dir>/<basename>_<hash>.webp`.
 * The content hash lets the preview be cached immutably for a long time even
 * though the video itself keeps a stable, unhashed filename.
 */
export function createVideoPreviewPath(videoPath: string, hash: string): string {
  const extension = path.extname(videoPath)
  const basename = path.basename(videoPath, extension)
  return path.join(path.dirname(videoPath), `${basename}_${hash}.webp`)
}
