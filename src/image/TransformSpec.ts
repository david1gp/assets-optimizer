import type { ImageFormat } from "./ImageFormat.js"

export interface TransformSpec {
  width: number
  height: number
  format: ImageFormat
  normalized: string
}
