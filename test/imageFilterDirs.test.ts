import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import { optimizeImages } from "../src/image/optimizeImages.js"

// Build a tiny solid-colour PNG so sharp has real input to optimize.
async function writePng(filePath: string, shade: number): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const buffer = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: shade, g: shade, b: shade } },
  })
    .png()
    .toBuffer()
  await fs.writeFile(filePath, buffer)
}

async function optimizedNames(optimizedDir: string): Promise<string[]> {
  return (await fs.readdir(optimizedDir)).sort()
}

describe("optimizeImages with imageFilterDirs", () => {
  let root: string
  let originalsDir: string
  let optimizedDir: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "assets-filter-"))
    originalsDir = path.join(root, "images")
    optimizedDir = path.join(root, "public", "images")
    await writePng(path.join(originalsDir, "cat-a", "256", "a.png"), 10)
    await writePng(path.join(originalsDir, "cat-b", "256", "b.png"), 200)
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  test("only encodes the filtered dir and leaves other outputs untouched", async () => {
    // First full run: both categories get optimized outputs.
    await optimizeImages({
      cwd: root,
      imageOriginalsDir: "images",
      imageOptimizedDir: "public/images",
      generateImageList: false,
    })
    const afterFull = await optimizedNames(optimizedDir)
    expect(afterFull.some((name) => name.startsWith("a_"))).toBe(true)
    expect(afterFull.some((name) => name.startsWith("b_"))).toBe(true)

    // Now work only on cat-a: add a new source there, and make cat-b's source
    // disappear so its output would be "stale" for a normal full run.
    await writePng(path.join(originalsDir, "cat-a", "256", "c.png"), 30)
    await fs.rm(path.join(originalsDir, "cat-b", "256", "b.png"))

    const filtered = await optimizeImages({
      cwd: root,
      imageOriginalsDir: "images",
      imageOptimizedDir: "public/images",
      generateImageList: false,
      imageFilterDirs: ["images/cat-a"],
    })

    const afterFiltered = await optimizedNames(optimizedDir)
    // cat-a's new file was encoded...
    expect(afterFiltered.some((name) => name.startsWith("c_"))).toBe(true)
    // ...and cat-b's now-stale output was left untouched (not deleted).
    expect(afterFiltered.some((name) => name.startsWith("b_"))).toBe(true)
    expect(filtered.deletedLocal).toEqual([])

    // Control: a full run with no filter prunes the stale cat-b output, proving
    // the filter is what protected it above.
    const full = await optimizeImages({
      cwd: root,
      imageOriginalsDir: "images",
      imageOptimizedDir: "public/images",
      generateImageList: false,
    })
    const afterPrune = await optimizedNames(optimizedDir)
    expect(afterPrune.some((name) => name.startsWith("b_"))).toBe(false)
    expect(full.deletedLocal.some((name) => name.startsWith("b_"))).toBe(true)
  })
})
