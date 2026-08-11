import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import type { AiLabelOptions } from "../src/image/AiLabelOptions.js"
import { optimizeImages } from "../src/image/optimizeImages.js"

let temporaryRoot: string | undefined

describe("classified image output identity", () => {
  test("reprocesses when any resolved label option changes", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "assets-ai-cache-options-"))
    const sourceFile = path.join(temporaryRoot, "images", "AI generated", "80x60_png", "item.png")
    await writeSource(sourceFile, await createSolidPng(80, 60, 128))

    const baseOptions: AiLabelOptions = {
      mode: "simple",
      simpleColor: "black",
      visual: "padding",
      opacity: "opaque",
      placement: "bottom-right",
      height: 20,
      offsetX: 0,
      offsetY: 0,
    }
    const optionChanges: AiLabelOptions[] = [
      { simpleColor: "white" },
      { visual: "circle" },
      { opacity: "50%" },
      { placement: "top-left" },
      { height: 24 },
      { offsetX: 3 },
      { offsetY: 4 },
      { mode: "adaptive" },
    ]

    try {
      const first = await runOptimizer(temporaryRoot, baseOptions)
      let previousName = onlyProcessedName(first.processed)

      for (const optionChange of optionChanges) {
        const result = await runOptimizer(temporaryRoot, { ...baseOptions, ...optionChange })
        const currentName = onlyProcessedName(result.processed)

        expect(currentName).not.toBe(previousName)
        expect(result.skippedExisting).toEqual([])
        expect(result.deletedLocal).toContain(previousName)
        previousName = currentName
      }

      const rerun = await runOptimizer(temporaryRoot, { ...baseOptions, mode: "adaptive" })
      expect(rerun.processed).toEqual([])
      expect(rerun.skippedExisting).toEqual([previousName])
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true })
      temporaryRoot = undefined
    }
  })

  test("reprocesses equivalent source content when moving into and out of a classified directory", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "assets-ai-cache-path-"))
    const source = await createSolidPng(80, 60, 128)
    const unclassifiedPath = path.join(temporaryRoot, "images", "plain", "80x60_png", "item.png")
    const classifiedPath = path.join(temporaryRoot, "images", "AI generated", "80x60_png", "item.png")

    try {
      await writeSource(unclassifiedPath, source)

      const unclassified = await runOptimizer(temporaryRoot)
      const unclassifiedName = onlyProcessedName(unclassified.processed)
      const unclassifiedOptionChange = await runOptimizer(temporaryRoot, { simpleColor: "white" })

      expect(unclassifiedOptionChange.processed).toEqual([])
      expect(unclassifiedOptionChange.skippedExisting).toEqual([unclassifiedName])

      await writeSource(classifiedPath, source)
      await fs.rm(unclassifiedPath)
      const classified = await runOptimizer(temporaryRoot)
      const classifiedName = onlyProcessedName(classified.processed)

      expect(classifiedName).not.toBe(unclassifiedName)
      expect(classified.skippedExisting).toEqual([])
      expect(classified.deletedLocal).toContain(unclassifiedName)

      await writeSource(unclassifiedPath, source)
      await fs.rm(classifiedPath)
      const restored = await runOptimizer(temporaryRoot)

      expect(restored.processed).toEqual([unclassifiedName])
      expect(restored.skippedExisting).toEqual([])
      expect(restored.deletedLocal).toContain(classifiedName)
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true })
      temporaryRoot = undefined
    }
  })
})

async function runOptimizer(root: string, aiLabelOptions: AiLabelOptions = {}) {
  return await optimizeImages({
    cwd: root,
    imageOriginalsDir: "images",
    imageOptimizedDir: "optimized",
    aiLabelOptions,
    generateImageList: false,
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

async function writeSource(filePath: string, source: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, source)
}

function onlyProcessedName(processed: string[]): string {
  if (processed.length !== 1) {
    throw new Error(`Expected one processed image, got ${processed.length}`)
  }

  return processed[0] as string
}

afterEach(async () => {
  if (temporaryRoot) {
    await fs.rm(temporaryRoot, { recursive: true, force: true })
    temporaryRoot = undefined
  }
})
