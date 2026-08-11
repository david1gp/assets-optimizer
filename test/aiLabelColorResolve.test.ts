import { describe, expect, test } from "bun:test"
import sharp from "sharp"
import { aiLabelColorResolve } from "../src/image/aiLabelColorResolve.js"

async function createImage(pixels: number[], width: number, height: number): Promise<Buffer> {
  return await sharp(Buffer.from(pixels), { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer()
}

async function createGrayscaleImage(pixels: number[], width: number, height: number): Promise<Buffer> {
  return await sharp(Buffer.from(pixels), { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer()
}

describe("AI label color", () => {
  test("selects black for a dark target", async () => {
    const image = await createImage([32, 32, 32, 255], 1, 1)

    expect(await aiLabelColorResolve(image, { x: 0, y: 0, width: 1, height: 1 })).toBe("black")
  })

  test("selects white for a light target", async () => {
    const image = await createImage([224, 224, 224, 255], 1, 1)

    expect(await aiLabelColorResolve(image, { x: 0, y: 0, width: 1, height: 1 })).toBe("white")
  })

  test("selects the lower-contrast color for a mixed target", async () => {
    const image = await createImage([240, 240, 240, 255, 240, 240, 240, 255, 240, 240, 240, 255, 24, 24, 24, 255], 2, 2)

    expect(await aiLabelColorResolve(image, { x: 0, y: 0, width: 2, height: 2 })).toBe("white")
  })

  test("weights visible pixels and ignores transparent pixels", async () => {
    const image = await createImage([240, 240, 240, 255, 24, 24, 24, 0], 2, 1)

    expect(await aiLabelColorResolve(image, { x: 0, y: 0, width: 2, height: 1 })).toBe("white")
  })

  test("weights partial pixel coverage in a fractional target rectangle", async () => {
    const image = await createImage([24, 24, 24, 255, 240, 240, 240, 255], 2, 1)

    expect(await aiLabelColorResolve(image, { x: 0.75, y: 0, width: 1, height: 1 })).toBe("white")
  })

  test("normalizes grayscale input before sampling luminance", async () => {
    const image = await createGrayscaleImage([224], 1, 1)

    expect(await aiLabelColorResolve(image, { x: 0, y: 0, width: 1, height: 1 })).toBe("white")
  })

  test("clips a target rectangle to the destination image", async () => {
    const image = await createImage([24, 24, 24, 255, 240, 240, 240, 255], 2, 1)

    expect(await aiLabelColorResolve(image, { x: 1, y: -10, width: 20, height: 20 })).toBe("white")
  })

  test("uses black when the target contains only transparent pixels", async () => {
    const image = await createImage([240, 240, 240, 0], 1, 1)

    expect(await aiLabelColorResolve(image, { x: 0, y: 0, width: 1, height: 1 })).toBe("black")
  })
})
