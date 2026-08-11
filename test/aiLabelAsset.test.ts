import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { aiLabelAssetFileName } from "../src/image/aiLabelAssetFileName.js"
import { aiLabelAssetLoad } from "../src/image/aiLabelAssetLoad.js"
import { aiLabelAssetResolve } from "../src/image/aiLabelAssetResolve.js"

const assetCases = [
  ["generated", "black", "padding", "opaque", "ai_generated_black_padding.svg"],
  ["generated", "black", "padding", "50%", "ai_generated_black_transparent_padding.svg"],
  ["generated", "white", "padding", "opaque", "ai_generated_white_padding.svg"],
  ["generated", "white", "padding", "50%", "ai_generated_white_transparent_padding.svg"],
  ["modified", "black", "padding", "opaque", "ai_modified_black_padding.svg"],
  ["modified", "black", "padding", "50%", "ai_modified_black_transparent_padding.svg"],
  ["modified", "white", "padding", "opaque", "ai_modified_white_padding.svg"],
  ["modified", "white", "padding", "50%", "ai_modified_white transparent_padding.svg"],
  ["generated", "black", "circle", "opaque", "ai_black_circle.svg"],
  ["generated", "black", "circle", "50%", "ai_black_50percent_transparent_circle.svg"],
  ["generated", "white", "circle", "opaque", "ai_white_circle.svg"],
  ["generated", "white", "circle", "50%", "ai_white_50percent_transparent_circle.svg"],
  ["modified", "black", "circle", "opaque", "ai_black_circle.svg"],
  ["modified", "black", "circle", "50%", "ai_black_50percent_transparent_circle.svg"],
  ["modified", "white", "circle", "opaque", "ai_white_circle.svg"],
  ["modified", "white", "circle", "50%", "ai_white_50percent_transparent_circle.svg"],
] as const

describe("AI label assets", () => {
  test.each(assetCases)("resolves and loads %s/%s/%s/%s", async (classification, color, visual, opacity, fileName) => {
    const options = { simpleColor: color, visual, opacity }
    const resolvedUrl = aiLabelAssetResolve(classification, options)
    const resolvedPath = new URL(resolvedUrl).pathname
    const loadedAsset = await aiLabelAssetLoad(classification, options)

    expect(aiLabelAssetFileName(classification, options)).toBe(fileName)
    expect(path.basename(decodeURIComponent(resolvedPath))).toBe(fileName)
    expect(loadedAsset).toEqual(await fs.readFile(resolvedUrl))
    expect(loadedAsset.length).toBeGreaterThan(0)
  })
})
