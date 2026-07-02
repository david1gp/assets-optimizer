import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import { optimizeImages } from "../src/image/optimizeImages.js"

// Build a tiny solid-colour PNG so sharp has real input to optimize.
async function writePng(filePath: string, width: number, height: number, shade: number): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: shade, g: shade, b: shade } },
  })
    .png()
    .toBuffer()
  await fs.writeFile(filePath, buffer)
}

async function optimizedNames(optimizedDir: string): Promise<string[]> {
  return (await fs.readdir(optimizedDir)).sort()
}

describe("optimizeImages with allowRootImageFiles", () => {
  let root: string
  let originalsDir: string
  let optimizedDir: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "assets-root-"))
    originalsDir = path.join(root, "images")
    optimizedDir = path.join(root, "public", "images")
    // A loose image at the originals root (12x9) plus a normal transform-folder image.
    await writePng(path.join(originalsDir, "hero.png"), 12, 9, 40)
    await writePng(path.join(originalsDir, "grouped", "256", "g.png"), 8, 8, 200)
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  test("skips root files by default and still processes transform folders", async () => {
    const result = await optimizeImages({
      cwd: root,
      imageOriginalsDir: "images",
      imageOptimizedDir: "public/images",
      generateImageList: false,
    })

    const names = await optimizedNames(optimizedDir)
    expect(names.some((name) => name.startsWith("hero_"))).toBe(false)
    expect(names.some((name) => name.startsWith("g_"))).toBe(true)
    expect(result.skippedRootFiles).toContain("hero.png")
    expect(result.processed.some((name) => name.startsWith("hero_"))).toBe(false)
  })

  test("optimizes root files at their native dimensions when enabled", async () => {
    const result = await optimizeImages({
      cwd: root,
      imageOriginalsDir: "images",
      imageOptimizedDir: "public/images",
      generateImageList: false,
      allowRootImageFiles: true,
    })

    const names = await optimizedNames(optimizedDir)
    const heroName = names.find((name) => name.startsWith("hero_"))
    expect(heroName).toBeDefined()
    expect(result.skippedRootFiles).toEqual([])
    expect(result.processed.some((name) => name.startsWith("hero_"))).toBe(true)
    // Transform-folder image is untouched by the root path.
    expect(names.some((name) => name.startsWith("g_"))).toBe(true)

    // Native dimensions preserved (no resize), output format from the extension.
    expect(heroName?.endsWith(".png")).toBe(true)
    const meta = await sharp(path.join(optimizedDir, heroName as string)).metadata()
    expect(meta.width).toBe(12)
    expect(meta.height).toBe(9)
  })

  test("applies a root alt sidecar to the generated image list", async () => {
    await fs.writeFile(path.join(originalsDir, "hero.md"), "A hero image.\n")
    const imageListOutputPath = path.join(root, "imageList.ts")

    await optimizeImages({
      cwd: root,
      imageOriginalsDir: "images",
      imageOptimizedDir: "public/images",
      allowRootImageFiles: true,
      imageListOutputPath,
      imageTypeImportPath: "@adaptive-ds/assets-optimizer",
    })

    const listSource = await fs.readFile(imageListOutputPath, "utf-8")
    expect(listSource).toContain("hero:")
    expect(listSource).toContain('alt: "A hero image."')
    expect(listSource).toContain("width: 12")
    expect(listSource).toContain("height: 9")
  })
})
