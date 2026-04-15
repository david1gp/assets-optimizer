export interface ImageType {
  path: string
  width: number
  height: number
  alt: string
  mimeType?: string
}

export interface VideoType {
  path: string
  mimeType?: string
  image: ImageType
}
