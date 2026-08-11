import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import type { AssetsOptimizeResult } from "../src/AssetsOptimizeResult.js"
import { aiClassificationDetect } from "../src/image/aiClassificationDetect.js"
import { aiClassificationParse } from "../src/image/aiClassificationParse.js"
import { buildExpectedImages } from "../src/image/buildExpectedImages.js"
import { parseTransformSpec } from "../src/image/parseTransformSpec.js"

let temporaryRoot: string | undefined

describe("AI classification parsing", () => {
  test.each([
    ["AI generated", "generated"],
    ["Ai-modified", "modified"],
    ["ai_generated", "generated"],
    ["cover.Ai.modified.png", "modified"],
  ] as const)("parses %s", (value, classification) => {
    expect(aiClassificationParse(value)).toBe(classification)
  })

  test.each(["aI generated", "AI Generated", "ordinary", "ai-generatedness"])("does not parse %s", (value) => {
    expect(aiClassificationParse(value)).toBeNull()
  })

  test("filename classification overrides a matching directory", () => {
    const sourceRoot = path.join("images")
    expect(aiClassificationDetect(path.join(sourceRoot, "AI generated", "portrait Ai_modified.png"), sourceRoot)).toBe(
      "modified",
    )
  })

  test("a matching directory classifies files beneath it", () => {
    const sourceRoot = path.join("images")
    expect(aiClassificationDetect(path.join(sourceRoot, "AI-modified", "group", "portrait.png"), sourceRoot)).toBe(
      "modified",
    )
  })

  test("uses the nearest matching directory", () => {
    const sourceRoot = path.join("images")
    expect(
      aiClassificationDetect(path.join(sourceRoot, "AI-generated", "AI-modified", "portrait.png"), sourceRoot),
    ).toBe("modified")
  })

  test("does not classify from an AI-named ancestor outside the source tree", () => {
    const sourceRoot = path.join("project", "AI-generated", "images")
    expect(aiClassificationDetect(path.join(sourceRoot, "group", "portrait.png"), sourceRoot)).toBeNull()
  })
})

describe("AI transform classification", () => {
  test.each([
    ["256_ai_generated", "generated", "256x256_webp_ai_generated"],
    ["512x256_webp_ai_modified", "modified", "512x256_webp_ai_modified"],
  ] as const)("parses %s with normalized identity %s", (name, classification, normalized) => {
    expect(parseTransformSpec(name)).toMatchObject({
      aiClassification: classification,
      normalized,
    })
  })

  test("explicit transform classification overrides source classification", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "assets-ai-"))
    const root = temporaryRoot
    const originalsDir = path.join(root, "images")
    const optimizedDir = path.join(root, "public", "images")
    const sourceFile = path.join(originalsDir, "AI modified", "256_ai_generated", "portrait.png")
    const sourceBuffer = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .png()
      .toBuffer()
    const transform = parseTransformSpec("256_ai_generated")
    if (!transform) {
      throw new Error("Expected AI transform")
    }

    await fs.mkdir(path.dirname(sourceFile), { recursive: true })
    await fs.mkdir(optimizedDir, { recursive: true })
    await fs.writeFile(sourceFile, sourceBuffer)

    const result = createResult()
    const expected = await buildExpectedImages(originalsDir, optimizedDir, result)

    expect(expected).toHaveLength(1)
    const expectedImage = expected[0]
    if (!expectedImage) {
      throw new Error("Expected one image")
    }

    expect(expectedImage.aiClassification).toBe("generated")
    expect(typeof expectedImage.localPath).toBe("string")
    expect(expectedImage.fileName).toMatch(/^portrait_[0-9a-f]+\.webp$/)
    expect(expectedImage.localPath).toBe(path.join(optimizedDir, expectedImage.fileName))
    expect(result.processed).toEqual([expectedImage.fileName])
  })

  test("does not classify a plain images tree from an external AI-named ancestor", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "assets-ai-"))
    const root = temporaryRoot
    const originalsDir = path.join(root, "AI-generated", "images")
    const optimizedDir = path.join(root, "public", "images")
    const sourceFile = path.join(originalsDir, "256", "portrait.png")
    const sourceBuffer = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .png()
      .toBuffer()

    await fs.mkdir(path.dirname(sourceFile), { recursive: true })
    await fs.mkdir(optimizedDir, { recursive: true })
    await fs.writeFile(sourceFile, sourceBuffer)

    const result = createResult()
    const expected = await buildExpectedImages(originalsDir, optimizedDir, result)

    expect(expected).toHaveLength(1)
    expect(expected[0]?.aiClassification).toBeUndefined()
  })
})

function createResult(): AssetsOptimizeResult {
  return {
    processed: [],
    skippedExisting: [],
    skippedRootFiles: [],
    warnings: [],
    deletedLocal: [],
    processedFonts: [],
    skippedExistingFonts: [],
    processedVideos: [],
    skippedExistingVideos: [],
    processedVideoPreviews: [],
    skippedExistingVideoPreviews: [],
  }
}

afterEach(async () => {
  if (temporaryRoot) {
    await fs.rm(temporaryRoot, { recursive: true, force: true })
    temporaryRoot = undefined
  }
})
