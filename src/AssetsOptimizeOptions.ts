import * as v from "valibot"
import { aiLabelOptionsSchema } from "./image/AiLabelOptions.js"

const finiteNumberSchema = v.pipe(v.number(), v.finite())
const positiveIntegerSchema = v.pipe(finiteNumberSchema, v.integer(), v.gtValue(0))
const stringArraySchema = v.pipe(v.array(v.string()), v.readonly())

export const assetsOptimizeOptionsSchema = v.strictObject({
  cwd: v.optional(v.string()),
  logLevel: v.optional(v.picklist([0, 1, 2, 3])),
  processImages: v.optional(v.boolean()),
  imageOriginalsDir: v.optional(v.string()),
  imageOptimizedDir: v.optional(v.string()),
  // Optimize loose image files sitting directly at the root of imageOriginalsDir
  // (i.e. not inside a WxH transform folder). Each is emitted once at its native
  // dimensions, format derived from its extension. Off by default: root files are
  // skipped so only transform-folder images are processed.
  allowRootImageFiles: v.optional(v.boolean()),
  imageHashLength: v.optional(positiveIntegerSchema),
  ignoredDirNames: v.optional(stringArraySchema),
  // Source dirs to scope image re-encoding to (absolute, or relative to cwd).
  // When set, only images under these dirs are (re)optimized and stale-deletion
  // is skipped; the generated image list still scans the full optimized dir so
  // it stays complete. Empty/undefined processes everything (default).
  imageFilterDirs: v.optional(stringArraySchema),
  aiLabelOptions: v.optional(aiLabelOptionsSchema),
  imageTypeImportPath: v.optional(v.string()),
  imageListOutputPath: v.optional(v.string()),
  generateImageList: v.optional(v.boolean()),
  processVideos: v.optional(v.boolean()),
  videoOriginalsDir: v.optional(v.string()),
  videoOptimizedDir: v.optional(v.string()),
  videoListOutputPath: v.optional(v.string()),
  generateVideoList: v.optional(v.boolean()),
  videoPreviewQuality: v.optional(v.pipe(finiteNumberSchema, v.integer(), v.minValue(1), v.maxValue(100))),
  videoPreviewHashLength: v.optional(positiveIntegerSchema),
  processFonts: v.optional(v.boolean()),
  fontOriginalsDir: v.optional(v.string()),
  fontOptimizedDir: v.optional(v.string()),
  fontListOutputPath: v.optional(v.string()),
  generateFontList: v.optional(v.boolean()),
})

export type AssetsOptimizeOptions = v.InferOutput<typeof assetsOptimizeOptionsSchema>
