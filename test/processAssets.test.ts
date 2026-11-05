import { expect, test } from "bun:test"
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { optimizeImages } from "../src/image/optimizeImages.js"
import { processAssets } from "../src/process/processAssets.js"

test("syncs originals and pulls existing outputs before optimizing on a fresh machine", async () => {
  const root = await mkdtemp("/tmp/opencode/process-assets-")
  try {
    const remote = path.join(root, "remote")
    const dest = path.join(root, "dest")
    const first = path.join(root, "first")
    const second = path.join(root, "second")
    await mkdir(remote, { recursive: true })
    await mkdir(first)
    await mkdir(second)
    const image = await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } })
      .png()
      .toBuffer()
    await writeFile(path.join(remote, "hero.png"), image)
    const options = {
      sourceImagesRemotePath: remote,
      sourceVideosRemotePath: "unused",
      sourceFontsRemotePath: "unused",
      destImagesRemotePath: dest,
      destVideosRemotePath: "unused",
      destFontsRemotePath: "unused",
      processVideos: false,
      processFonts: false,
      allowRootImageFiles: true,
      generateImageList: false,
      logLevel: 0 as const,
    }
    await processAssets({ ...options, cwd: first })
    expect((await readFile(path.join(first, "images/hero.png"))).equals(image)).toBe(true)
    expect(JSON.parse(await readFile(path.join(remote, ".assets-sync/catalog.json"), "utf8")).version).toBe(1)
    const outputs = await readdir(dest)
    expect(outputs).toHaveLength(1)
    const originalOutput = await readFile(path.join(dest, outputs[0]!))
    await processAssets({ ...options, cwd: second })
    expect(await readFile(path.join(second, "public/images", outputs[0]!))).toEqual(originalOutput)
    expect(await readdir(dest)).toEqual(outputs)

    // Sync deliberately refuses unresolved conflicts, so exercise the optimizer directly.
    await writeFile(path.join(second, "images/hero.remote-conflict.png"), image)
    await mkdir(path.join(second, "images/.assets-sync/256"), { recursive: true })
    await writeFile(path.join(second, "images/.assets-sync/256/hidden.png"), image)
    const result = await optimizeImages({
      cwd: second,
      allowRootImageFiles: true,
      generateImageList: false,
      logLevel: 0,
    })
    expect(result.processed).toEqual([])
    expect(await readdir(path.join(second, "public/images"))).toEqual(outputs)

    // A stale output present only on R2 is pulled, then pruned by the image
    // optimizer before the final sync propagates that deletion back to R2.
    await rm(path.join(second, "images/hero.remote-conflict.png"))
    await rm(path.join(second, "images/hero.png"))
    await rm(path.join(second, "public/images"), { recursive: true })
    await processAssets({ ...options, cwd: second })
    expect(await readdir(dest)).toEqual([])
    expect(await readdir(path.join(second, "public/images"))).toEqual([])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30000)
