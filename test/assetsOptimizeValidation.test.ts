import { describe, expect, test } from "bun:test"
import { assetsOptimize } from "../src/assetsOptimize.js"

const disabledOptions = {
  processImages: false,
  processVideos: false,
  processFonts: false,
}

describe("assetsOptimize options validation", () => {
  test("accepts the complete options object", async () => {
    const result = await assetsOptimize({
      cwd: ".",
      logLevel: 0,
      ...disabledOptions,
      imageOriginalsDir: "images",
      imageOptimizedDir: "public/images",
      allowRootImageFiles: true,
      imageHashLength: 3,
      ignoredDirNames: ["node_modules"],
      imageFilterDirs: ["src"],
      aiLabelOptions: {
        mode: "adaptive",
        simpleColor: "white",
        visual: "circle",
        opacity: "50%",
        placement: "top-left",
        height: 32,
        offsetX: -4,
        offsetY: 2,
      },
      imageTypeImportPath: "@example/assets",
      imageListOutputPath: "src/imageList.ts",
      generateImageList: false,
      videoOriginalsDir: "videos",
      videoOptimizedDir: "public/videos",
      videoListOutputPath: "src/videoList.ts",
      generateVideoList: false,
      videoPreviewQuality: 80,
      videoPreviewHashLength: 6,
      fontOriginalsDir: "fonts",
      fontOptimizedDir: "public/fonts",
      fontListOutputPath: "src/fontList.ts",
      generateFontList: false,
    })

    expect(result.processed).toEqual([])
  })

  test.each([
    ["unknown root keys", { unexpected: true }],
    ["unknown nested keys", { aiLabelOptions: { unexpected: true } }],
    ["primitive types", { processImages: "false" }],
    ["array types", { ignoredDirNames: "node_modules" }],
    ["enum-like values", { aiLabelOptions: { mode: "automatic" } }],
    ["non-positive label height", { aiLabelOptions: { height: 0 } }],
    ["non-finite offsets", { aiLabelOptions: { offsetX: Number.NaN } }],
    ["non-positive hash lengths", { imageHashLength: 0 }],
    ["non-integer hash lengths", { videoPreviewHashLength: 1.5 }],
    ["video quality outside its consumer range", { videoPreviewQuality: 101 }],
  ])("rejects %s", async (_name, overrides) => {
    await expect(assetsOptimize({ ...disabledOptions, ...overrides } as never)).rejects.toThrow(
      "Invalid assetsOptimize options",
    )
  })
})
