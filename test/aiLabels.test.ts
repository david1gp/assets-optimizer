import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import type { AiLabelOptions } from "../src/index.js"
import { assetsOptimize } from "../src/index.js"

type RawImage = {
  data: Buffer
  info: {
    width: number
    height: number
    channels: number
  }
}

type PixelBounds = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

describe("AI labels through the public optimizer API", () => {
  test("classifies filenames and ancestors, overrides with transform suffixes, and leaves plain images unchanged", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "assets-ai-e2e-"))
    const optimizedDir = "optimized"
    const source = await createSolidPng(200, 100, 128)

    try {
      await writeSource(root, ["images", "AI generated", "200x100_png", "ancestor.png"], source)
      await writeSource(root, ["images", "AI generated", "200x100_png", "filename-Ai_modified.png"], source)
      await writeSource(root, ["images", "AI modified", "200x100_png_ai_generated", "identity.png"], source)
      await writeSource(root, ["images", "AI modified", "200x100_png", "identity.png"], source)
      await writeSource(root, ["images", "plain", "200x100_png", "plain.png"], source)

      const result = await runOptimizer(root, optimizedDir, {
        simpleColor: "black",
        visual: "padding",
        opacity: "opaque",
        height: 20,
      })

      expect(result.processed).toHaveLength(5)
      expect(result.warnings).toEqual([])

      const ancestorOutput = getOutputPath(result, root, optimizedDir, "ancestor")
      const filenameOutput = getOutputPath(result, root, optimizedDir, "filename-Ai_modified")
      const identityOutputs = result.processed
        .filter((fileName) => fileName.startsWith("identity_"))
        .map((fileName) => path.join(root, optimizedDir, fileName))
      const plainOutput = getOutputPath(result, root, optimizedDir, "plain")

      expect(identityOutputs).toHaveLength(2)
      expect(identityOutputs[0]).not.toBe(identityOutputs[1])

      const ancestorRaw = await readRaw(ancestorOutput)
      const filenameRaw = await readRaw(filenameOutput)
      const identityRaws = await Promise.all(identityOutputs.map(readRaw))
      const plainRaw = await readRaw(plainOutput)
      const generatedBounds = changedBounds(ancestorRaw, 128)
      const filenameBounds = changedBounds(filenameRaw, 128)
      const identityBounds = identityRaws.map((raw) => changedBounds(raw, 128))
      const generatedSuffixBounds = identityBounds.find((bounds) => bounds?.width === generatedBounds?.width)
      const modifiedSuffixBounds = identityBounds.find((bounds) => bounds?.width === filenameBounds?.width)

      expect(generatedBounds).not.toBeNull()
      expect(filenameBounds).not.toBeNull()
      expect(generatedSuffixBounds).toEqual(generatedBounds)
      expect(modifiedSuffixBounds).toEqual(filenameBounds)
      expect(generatedBounds?.width).toBeGreaterThan(filenameBounds?.width ?? 0)
      expect(changedBounds(plainRaw, 128)).toBeNull()

      for (const outputPath of [ancestorOutput, filenameOutput, ...identityOutputs, plainOutput]) {
        await expectDimensions(outputPath, 200, 100)
      }

      const expectedPlain = await sharp(source, { animated: false })
        .rotate()
        .resize({ width: 200, height: 100, fit: "inside", withoutEnlargement: true })
        .png({ quality: 100 })
        .toBuffer()
      expect(Buffer.from(await fs.readFile(plainOutput)).equals(expectedPlain)).toBe(true)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  test("applies every placement with configured height and offsets", async () => {
    const placements = [
      ["top-left", 7, 9] as const,
      ["top-right", 53, 9] as const,
      ["bottom-left", 7, 31] as const,
      ["bottom-right", 53, 31] as const,
    ]

    for (const [placement, left, top] of placements) {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "assets-ai-placement-"))
      const source = await createSolidPng(80, 60, 128)

      try {
        await writeSource(root, ["images", "AI generated", "80x60_png", "item.png"], source)
        const result = await runOptimizer(root, "optimized", {
          simpleColor: "black",
          visual: "circle",
          opacity: "opaque",
          placement,
          height: 20,
          offsetX: 7,
          offsetY: 9,
        })
        const outputPath = getOutputPath(result, root, "optimized", "item")
        const output = await readRaw(outputPath)

        expect(changedBounds(output, 128)).toEqual({
          left,
          top,
          right: left + 19,
          bottom: top + 19,
          width: 20,
          height: 20,
        })
        await expectDimensions(outputPath, 80, 60)
      } finally {
        await fs.rm(root, { recursive: true, force: true })
      }
    }
  })

  test("renders simple colors, visual variants, and opacity variants", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "assets-ai-variants-"))
    const source = await createSolidPng(200, 100, 128)

    try {
      await writeSource(root, ["images", "AI generated", "200x100_png", "variant.png"], source)

      const blackPaddingResult = await runOptimizer(root, "black-padding", {
        simpleColor: "black",
        visual: "padding",
        opacity: "opaque",
        height: 20,
      })
      const whitePaddingResult = await runOptimizer(root, "white-padding", {
        simpleColor: "white",
        visual: "padding",
        opacity: "opaque",
        height: 20,
      })
      const blackCircleResult = await runOptimizer(root, "black-circle", {
        simpleColor: "black",
        visual: "circle",
        opacity: "opaque",
        height: 20,
      })
      const transparentPaddingResult = await runOptimizer(root, "transparent-padding", {
        simpleColor: "black",
        visual: "padding",
        opacity: "50%",
        height: 20,
      })

      const blackPadding = await readRaw(getOutputPath(blackPaddingResult, root, "black-padding", "variant"))
      const whitePadding = await readRaw(getOutputPath(whitePaddingResult, root, "white-padding", "variant"))
      const blackCircle = await readRaw(getOutputPath(blackCircleResult, root, "black-circle", "variant"))
      const transparentPadding = await readRaw(
        getOutputPath(transparentPaddingResult, root, "transparent-padding", "variant"),
      )

      expect(pixelChannel(blackPadding, 150, 81)).toBe(0)
      expect(pixelChannel(whitePadding, 150, 81)).toBe(255)
      expect(pixelChannel(transparentPadding, 150, 81)).toBe(63)
      expect(pixelChannel(blackCircle, 150, 81)).toBe(128)
      expect(pixelChannel(blackCircle, 184, 90)).toBe(0)

      await expectDimensions(getOutputPath(blackPaddingResult, root, "black-padding", "variant"), 200, 100)
      await expectDimensions(getOutputPath(whitePaddingResult, root, "white-padding", "variant"), 200, 100)
      await expectDimensions(getOutputPath(blackCircleResult, root, "black-circle", "variant"), 200, 100)
      await expectDimensions(getOutputPath(transparentPaddingResult, root, "transparent-padding", "variant"), 200, 100)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  test("chooses adaptive colors from dark and light target regions", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "assets-ai-adaptive-"))
    const darkSource = await createSolidPng(80, 60, 32)
    const lightSource = await createSolidPng(80, 60, 224)

    try {
      await writeSource(root, ["images", "AI generated", "80x60_png", "dark.png"], darkSource)
      await writeSource(root, ["images", "AI generated", "80x60_png", "light.png"], lightSource)
      const result = await runOptimizer(root, "optimized", {
        mode: "adaptive",
        simpleColor: "black",
        visual: "circle",
        opacity: "opaque",
      })

      const darkOutput = await readRaw(getOutputPath(result, root, "optimized", "dark"))
      const lightOutput = await readRaw(getOutputPath(result, root, "optimized", "light"))

      expect(pixelChannel(darkOutput, 64, 50)).toBeLessThan(32)
      expect(pixelChannel(lightOutput, 64, 50)).toBeGreaterThan(224)
      await expectDimensions(getOutputPath(result, root, "optimized", "dark"), 80, 60)
      await expectDimensions(getOutputPath(result, root, "optimized", "light"), 80, 60)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  test("preserves classified labels through JPG, WebP, and AVIF encoding", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "assets-ai-formats-"))
    const source = await createSolidPng(80, 60, 224)
    const formats = [
      ["jpg", "jpeg"],
      ["webp", "webp"],
      ["avif", "heif"],
    ] as const

    try {
      for (const [format] of formats) {
        await writeSource(root, ["images", "AI generated", `80x60_${format}`, `item-${format}.png`], source)
      }
      const result = await runOptimizer(root, "optimized", {
        simpleColor: "black",
        visual: "circle",
        opacity: "opaque",
        height: 20,
      })

      expect(result.processed).toHaveLength(formats.length)
      expect(result.warnings).toEqual([])

      for (const [format, metadataFormat] of formats) {
        const outputPath = getOutputPath(result, root, "optimized", `item-${format}`)
        const metadata = await sharp(outputPath).metadata()
        const output = await readRaw(outputPath)

        expect(metadata.format).toBe(metadataFormat)
        expect(metadata.width).toBe(80)
        expect(metadata.height).toBe(60)
        if (format === "avif") {
          expect(metadata.compression).toBe("av1")
        }
        expect(pixelChannel(output, 64, 50)).toBeLessThan(100)
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  test("keeps classified labels safe on images smaller than the default label", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "assets-ai-small-"))
    const source = await createSolidPng(3, 2, 96)

    try {
      await writeSource(root, ["images", "AI generated", "16x16_png", "tiny.png"], source)
      const result = await runOptimizer(root, "optimized", {
        simpleColor: "black",
        visual: "padding",
        opacity: "opaque",
      })
      const outputPath = getOutputPath(result, root, "optimized", "tiny")
      const output = await readRaw(outputPath)

      expect(output.info.width).toBe(3)
      expect(output.info.height).toBe(2)
      expect(output.data).toHaveLength(output.info.width * output.info.height * output.info.channels)
      expect(changedBounds(output, 96)).not.toBeNull()
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})

async function runOptimizer(root: string, imageOptimizedDir: string, aiLabelOptions: AiLabelOptions) {
  return await assetsOptimize({
    cwd: root,
    logLevel: 0,
    imageOriginalsDir: "images",
    imageOptimizedDir,
    aiLabelOptions,
    generateImageList: false,
    processVideos: false,
    processFonts: false,
  })
}

async function createSolidPng(width: number, height: number, shade: number): Promise<Buffer> {
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

async function writeSource(root: string, segments: string[], source: Buffer): Promise<void> {
  const filePath = path.join(root, ...segments)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, source)
}

function getOutputPath(
  result: { processed: string[] },
  root: string,
  imageOptimizedDir: string,
  baseName: string,
): string {
  const outputName = result.processed.find((name) => name.startsWith(`${baseName}_`))
  if (!outputName) {
    throw new Error(`Missing processed output for ${baseName}`)
  }

  return path.join(root, imageOptimizedDir, outputName)
}

async function readRaw(filePath: string): Promise<RawImage> {
  return await sharp(filePath).raw().toBuffer({ resolveWithObject: true })
}

async function expectDimensions(filePath: string, width: number, height: number): Promise<void> {
  const metadata = await sharp(filePath).metadata()
  expect(metadata.width).toBe(width)
  expect(metadata.height).toBe(height)
}

function pixelChannel(image: RawImage, x: number, y: number): number {
  const offset = (y * image.info.width + x) * image.info.channels
  return image.data[offset] ?? 0
}

function changedBounds(image: RawImage, shade: number): PixelBounds | null {
  let left = image.info.width
  let top = image.info.height
  let right = -1
  let bottom = -1

  for (let y = 0; y < image.info.height; y += 1) {
    for (let x = 0; x < image.info.width; x += 1) {
      const offset = (y * image.info.width + x) * image.info.channels
      const changed = Array.from({ length: Math.min(3, image.info.channels) }).some(
        (_, channel) => (image.data[offset + channel] ?? shade) !== shade,
      )
      if (!changed) {
        continue
      }

      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  if (right < left || bottom < top) {
    return null
  }

  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
  }
}
