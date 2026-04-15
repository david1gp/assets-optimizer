import { type ImageFormat } from "./ImageFormat.js"
import { imageFormats } from "./imageFormats.js"

export function isImageFormat(value: string): value is ImageFormat {
  return imageFormats.has(value as ImageFormat)
}
