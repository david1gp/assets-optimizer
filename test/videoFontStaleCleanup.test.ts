import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fontStaleOutputsRemove } from "../src/font/fontStaleOutputsRemove.js"
import { createLogger } from "../src/shared/logger.js"
import { videoStaleOutputsRemove } from "../src/video/videoStaleOutputsRemove.js"

const roots: string[] = []
const logger = createLogger(0)
async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "asset-cleanup-"))
  roots.push(root)
  return { originals: path.join(root, "originals"), outputs: path.join(root, "outputs") }
}
async function put(root: string, file: string) {
  const target = path.join(root, file)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, "content")
}
async function exists(root: string, file: string) {
  return fs.access(path.join(root, file)).then(
    () => true,
    () => false,
  )
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

test("removes orphan videos and hashed previews while preserving shared basenames and unrelated files", async () => {
  const { originals, outputs } = await setup()
  await put(originals, "nested/keep.mov")
  for (const file of [
    "nested/keep.mov",
    "nested/keep.mp4",
    "nested/keep_ab12.webp",
    "nested/gone.mp4",
    "nested/gone_1234.webp",
    "nested/gone_abcd.webp",
    "nested/notes.webp",
    "nested/gone.jpg",
  ])
    await put(outputs, file)
  await videoStaleOutputsRemove(originals, outputs, logger)
  for (const file of ["nested/keep.mov", "nested/keep_ab12.webp", "nested/notes.webp", "nested/gone.jpg"])
    expect(await exists(outputs, file)).toBe(true)
  for (const file of ["nested/keep.mp4", "nested/gone.mp4", "nested/gone_1234.webp", "nested/gone_abcd.webp"])
    expect(await exists(outputs, file)).toBe(false)
})

test("removes orphan woff2 files and preserves outputs for any supported original extension", async () => {
  const { originals, outputs } = await setup()
  for (const file of ["a/font.TTF", "a/copy.woff2", "a/same.otf"]) await put(originals, file)
  for (const file of [
    "a/font.woff2",
    "a/copy.woff2",
    "a/same.woff2",
    "a/gone.woff2",
    "a/unrelated.ttf",
    "a/unrelated.WOFF2",
  ])
    await put(outputs, file)
  await fontStaleOutputsRemove(originals, outputs, logger)
  expect(await exists(outputs, "a/gone.woff2")).toBe(false)
  for (const file of ["a/font.woff2", "a/copy.woff2", "a/same.woff2", "a/unrelated.ttf", "a/unrelated.WOFF2"])
    expect(await exists(outputs, file)).toBe(true)
})

test("missing originals skip cleanup, but an existing empty directory is authoritative", async () => {
  const { originals, outputs } = await setup()
  for (const file of ["gone.mp4", "gone_ab12.webp", "gone.woff2"]) await put(outputs, file)
  await videoStaleOutputsRemove(originals, outputs, logger)
  await fontStaleOutputsRemove(originals, outputs, logger)
  expect(await exists(outputs, "gone.mp4")).toBe(true)
  expect(await exists(outputs, "gone.woff2")).toBe(true)
  await fs.mkdir(originals)
  await videoStaleOutputsRemove(originals, outputs, logger)
  await fontStaleOutputsRemove(originals, outputs, logger)
  for (const file of ["gone.mp4", "gone_ab12.webp", "gone.woff2"]) expect(await exists(outputs, file)).toBe(false)
})
