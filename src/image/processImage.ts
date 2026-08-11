import sharp from "sharp"
import { assertNever } from "../shared/assertNever.js"
import type { AiClassification } from "./AiClassification.js"
import type { AiLabelOptions } from "./AiLabelOptions.js"
import { aiLabelAssetLoad } from "./aiLabelAssetLoad.js"
import { aiLabelColorResolve } from "./aiLabelColorResolve.js"
import { aiLabelGeometryResolve } from "./aiLabelGeometryResolve.js"
import { aiLabelOptionsResolve } from "./aiLabelOptionsResolve.js"
import { defaultQuality } from "./defaultQuality.js"
import type { TransformSpec } from "./TransformSpec.js"

export async function processImage(
  sourceBuffer: Buffer,
  outputPath: string,
  transform: TransformSpec,
  quality = defaultQuality,
  options: {
    aiClassification?: AiClassification
    aiLabelOptions?: AiLabelOptions
  } = {},
): Promise<void> {
  const aiClassification = options.aiClassification ?? transform.aiClassification
  let pipeline = sharp(sourceBuffer, { animated: false }).rotate().resize({
    width: transform.width,
    height: transform.height,
    fit: "inside",
    withoutEnlargement: true,
  })

  if (aiClassification) {
    const resized = await pipeline.png().toBuffer({ resolveWithObject: true })
    const aiLabelOptions = aiLabelOptionsResolve(options.aiLabelOptions)
    const geometryColor = aiLabelOptions.mode === "adaptive" ? "black" : aiLabelOptions.simpleColor
    const geometryAssetOptions = {
      simpleColor: geometryColor,
      visual: aiLabelOptions.visual,
      opacity: aiLabelOptions.opacity,
    }
    const geometryAsset = await aiLabelAssetLoad(aiClassification, geometryAssetOptions)
    const geometryAssetMetadata = await sharp(geometryAsset).metadata()
    const geometry = aiLabelGeometryResolve(
      aiLabelOptions,
      { width: resized.info.width, height: resized.info.height },
      { width: geometryAssetMetadata.width ?? 0, height: geometryAssetMetadata.height ?? 0 },
    )

    pipeline = sharp(resized.data, { animated: false })
    if (geometry.width > 0 && geometry.height > 0) {
      const labelWidth = Math.min(resized.info.width, Math.max(1, Math.round(geometry.width)))
      const labelHeight = Math.min(resized.info.height, Math.max(1, Math.round(geometry.height)))
      const left = clamp(Math.round(geometry.x), 0, resized.info.width - labelWidth)
      const top = clamp(Math.round(geometry.y), 0, resized.info.height - labelHeight)
      const labelColor =
        aiLabelOptions.mode === "adaptive"
          ? await aiLabelColorResolve(resized.data, { x: left, y: top, width: labelWidth, height: labelHeight })
          : aiLabelOptions.simpleColor
      const labelAssetOptions = { ...geometryAssetOptions, simpleColor: labelColor }
      const labelAsset =
        labelColor === geometryColor ? geometryAsset : await aiLabelAssetLoad(aiClassification, labelAssetOptions)
      const resizedLabel = await sharp(labelAsset)
        .resize({ width: labelWidth, height: labelHeight, fit: "fill" })
        .png()
        .toBuffer()

      pipeline = pipeline.composite([{ input: resizedLabel, left, top }])
    }
  }

  switch (transform.format) {
    case "jpg":
      pipeline = pipeline.jpeg({ quality })
      break
    case "png":
      // PNG: use 100 to preserve original quality (lossless)
      pipeline = pipeline.png({ quality: 100 })
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
