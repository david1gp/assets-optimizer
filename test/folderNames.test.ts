import { describe, expect, test } from "bun:test"
import { parseTransformSpec } from "../src/image/parseTransformSpec.js"
import { isIgnoredDir } from "../src/shared/isIgnoredDir.js"

describe("ignored folder names", () => {
  test.each([
    "ignore",
    "ignored",
    "_ignore",
    ".git",
    "discarded",
    "old-discarded-assets",
    "skipped",
    "skipped_exports",
    "staging",
    "staging-area",
    "STAGING",
  ])("ignores %s by default", (name) => {
    expect(isIgnoredDir(name)).toBe(true)
  })

  test.each([
    "modules",
    "new",
    "1920x1080",
    "256",
    "resources",
    "ships_v2",
  ])("does not ignore %s by default", (name) => {
    expect(isIgnoredDir(name)).toBe(false)
  })

  test("uses caller-provided ignored folder names", () => {
    expect(isIgnoredDir("archive", ["archive"])).toBe(true)
    expect(isIgnoredDir("old-archive-assets", ["archive"])).toBe(true)
    expect(isIgnoredDir("drafts", ["archive"])).toBe(false)
  })

  test("ignores empty caller-provided names", () => {
    expect(isIgnoredDir("modules", ["", "  "])).toBe(false)
  })
})

describe("transform folder names", () => {
  test.each([
    ["1920x1080_webp", 1920, 1080, "webp", "1920x1080_webp"],
    ["1920x1080_jpg", 1920, 1080, "jpg", "1920x1080_jpg"],
    ["1600x900", 1600, 900, "webp", "1600x900_webp"],
    ["1200_webp", 1200, 1200, "webp", "1200x1200_webp"],
    ["1200", 1200, 1200, "webp", "1200x1200_webp"],
    ["256", 256, 256, "webp", "256x256_webp"],
    ["512x256", 512, 256, "webp", "512x256_webp"],
    ["512_256_webp", 512, 256, "webp", "512x256_webp"],
  ] as const)("matches %s", (name, width, height, format, normalized) => {
    expect(parseTransformSpec(name)).toEqual({ width, height, format, normalized })
  })

  test.each([
    "modules",
    "new",
    "resources",
    "ships_v2",
    "1920x",
    "x1080",
    "0x100_webp",
    "100x0_webp",
    "100_gif",
    "1920x1080_webp_extra",
  ])("does not match %s", (name) => {
    expect(parseTransformSpec(name)).toBeNull()
  })
})

describe("folder classification examples", () => {
  test.each([
    [".git", true, false],
    ["ignored", true, false],
    ["staging", true, false],
    ["discarded", true, false],
    ["skipped", true, false],
    ["1920x1080", false, true],
    ["256", false, true],
    ["512x256", false, true],
    ["1200_webp", false, true],
    ["modules", false, false],
    ["new", false, false],
  ] as const)("classifies %s", (name, ignored, matchedTransform) => {
    expect(isIgnoredDir(name)).toBe(ignored)
    expect(parseTransformSpec(name) !== null).toBe(matchedTransform)
  })
})
