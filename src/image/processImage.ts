import sharp from "sharp"
import { assertNever } from "../shared/assertNever.js"
import { defaultQuality } from "./defaultQuality.js"
import type { TransformSpec } from "./TransformSpec.js"

export async function processImage(
  sourceBuffer: Buffer,
  outputPath: string,
  transform: TransformSpec,
  quality = defaultQuality,
): Promise<void> {
  let pipeline = sharp(sourceBuffer, { animated: false }).rotate().resize({
    width: transform.width,
    height: transform.height,
    fit: "inside",
    withoutEnlargement: true,
  })

  switch (transform.format) {
    case "jpg":
      pipeline = pipeline.jpeg({ quality })
      break
    case "png":
      pipeline = pipeline.png({ quality })
      break
    case "webp":
      pipeline = pipeline.webp({ quality })
      break
    case "avif":
      pipeline = pipeline.avif({ quality })
      break
    default:
      assertNever(transform.format)
  }

  await pipeline.toFile(outputPath)
}
