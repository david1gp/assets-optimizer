import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import { processImage } from "../src/image/processImage.js"

let temporaryRoot: string | undefined

describe("processImage AI labels", () => {
  test("resolves defaults when passed partial label options", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "assets-process-image-"))
    const source = await createSolidImage(160, 80, 240)
    const outputPath = path.join(temporaryRoot, "output.png")

    await processImage(
      source,
      outputPath,
      { width: 80, height: 40, format: "png", normalized: "80x40_png" },
      undefined,
      { aiClassification: "generated", aiLabelOptions: { height: 20 } },
    )

    const output = await sharp(outputPath).raw().toBuffer({ resolveWithObject: true })
    expect(output.info.width).toBe(80)
    expect(output.info.height).toBe(40)
    expect(output.data.some((value, index) => index % output.info.channels === 0 && value < 100)).toBe(true)
  })

  test("composites a classified label after resizing and encodes the requested format", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "assets-process-image-"))
    const source = await createSolidImage(160, 80, 240)
    const outputPath = path.join(temporaryRoot, "output.png")

    await processImage(
      source,
      outputPath,
      { width: 80, height: 40, format: "png", normalized: "80x40_png" },
      undefined,
      {
        aiClassification: "generated",
        aiLabelOptions: {
          mode: "simple",
          simpleColor: "black",
          visual: "circle",
          opacity: "opaque",
          placement: "bottom-right",
          height: 20,
          offsetX: 3,
          offsetY: 2,
        },
      },
    )

    const output = await sharp(outputPath).raw().toBuffer({ resolveWithObject: true })
    expect(output.info.width).toBe(80)
    expect(output.info.height).toBe(40)
    expect(output.info.channels).toBe(3)
    expect(output.data.some((value, index) => index % output.info.channels === 0 && value < 100)).toBe(true)
  })

  test("uses adaptive color from the resized destination region", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "assets-process-image-"))
    const source = await createSolidImage(160, 80, 224)
    const adaptivePath = path.join(temporaryRoot, "adaptive.png")
    const whitePath = path.join(temporaryRoot, "white.png")
    const blackPath = path.join(temporaryRoot, "black.png")
    const transform = { width: 80, height: 40, format: "png" as const, normalized: "80x40_png" }
    const baseOptions = {
      visual: "circle" as const,
      opacity: "opaque" as const,
      placement: "bottom-right" as const,
      height: 20,
      offsetX: 0,
      offsetY: 0,
    }

    await processImage(source, adaptivePath, transform, undefined, {
      aiClassification: "modified",
      aiLabelOptions: { ...baseOptions, mode: "adaptive", simpleColor: "black" },
    })
    await processImage(source, whitePath, transform, undefined, {
      aiClassification: "modified",
      aiLabelOptions: { ...baseOptions, mode: "simple", simpleColor: "white" },
    })
    await processImage(source, blackPath, transform, undefined, {
      aiClassification: "modified",
      aiLabelOptions: { ...baseOptions, mode: "simple", simpleColor: "black" },
    })

    expect(await fs.readFile(adaptivePath)).toEqual(await fs.readFile(whitePath))
    expect(await fs.readFile(adaptivePath)).not.toEqual(await fs.readFile(blackPath))
  })

  test("uses the rounded composite rectangle for adaptive color at a placement threshold", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "assets-process-image-"))
    const source = await createImage([24, 24, 24, 255, 240, 240, 240, 255], 2, 1)
    const adaptivePath = path.join(temporaryRoot, "adaptive.png")
    const whitePath = path.join(temporaryRoot, "white.png")
    const blackPath = path.join(temporaryRoot, "black.png")
    const transform = { width: 2, height: 1, format: "png" as const, normalized: "2x1_png" }
    const baseOptions = {
      visual: "circle" as const,
      opacity: "opaque" as const,
      placement: "top-left" as const,
      height: 0.5,
      offsetX: 0.51,
      offsetY: 0,
    }

    await processImage(source, adaptivePath, transform, undefined, {
      aiClassification: "modified",
      aiLabelOptions: { ...baseOptions, mode: "adaptive", simpleColor: "black" },
    })
    await processImage(source, whitePath, transform, undefined, {
      aiClassification: "modified",
      aiLabelOptions: { ...baseOptions, mode: "simple", simpleColor: "white" },
    })
    await processImage(source, blackPath, transform, undefined, {
      aiClassification: "modified",
      aiLabelOptions: { ...baseOptions, mode: "simple", simpleColor: "black" },
    })

    expect(await fs.readFile(adaptivePath)).toEqual(await fs.readFile(whitePath))
    expect(await fs.readFile(adaptivePath)).not.toEqual(await fs.readFile(blackPath))
  })

  test("keeps the unclassified Sharp path byte-equivalent", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "assets-process-image-"))
    const source = await createSolidImage(160, 80, 80)
    const outputPath = path.join(temporaryRoot, "output.webp")
    const transform = { width: 80, height: 40, format: "webp" as const, normalized: "80x40_webp" }

    await processImage(source, outputPath, transform)
    const expected = await sharp(source, { animated: false })
      .rotate()
      .resize({ width: 80, height: 40, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    expect(Buffer.compare(await fs.readFile(outputPath), expected)).toBe(0)
  })
})

async function createSolidImage(width: number, height: number, shade: number): Promise<Buffer> {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: shade, g: shade, b: shade },
    },
  })
    .png()
    .toBuffer()
}

async function createImage(pixels: number[], width: number, height: number): Promise<Buffer> {
  return await sharp(Buffer.from(pixels), { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer()
}

afterEach(async () => {
  if (temporaryRoot) {
    await fs.rm(temporaryRoot, { recursive: true, force: true })
    temporaryRoot = undefined
  }
})
