/**
 * Stable transform identity for a generated video preview image.
 * Included in the preview content hash so the hashed filename (and therefore
 * the cache key) busts when the encoding parameters change.
 */
export function videoPreviewTransformSpec(quality: number): string {
  return `video-preview|webp|q${quality}`
}
