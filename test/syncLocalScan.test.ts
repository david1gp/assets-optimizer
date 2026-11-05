import { expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { syncConflictPath } from "../src/sync/syncConflictPath.js"
import { syncLocalConflictList } from "../src/sync/syncLocalConflictList.js"
import { syncLocalScan } from "../src/sync/syncLocalScan.js"

test("local scan caches hashes and excludes metadata, conflicts, dotfiles and ignored dirs", async () => {
  const root = await mkdtemp("/tmp/opencode/sync-scan-")
  try {
    await mkdir(join(root, "dir"))
    await mkdir(join(root, "ignore"))
    await writeFile(join(root, "dir/a.jpg"), "hello")
    await writeFile(join(root, "dir/a.remote-conflict.jpg"), "conflict")
    await writeFile(join(root, ".DS_Store"), "hidden")
    await writeFile(join(root, "ignore/ignored"), "ignored")
    const first = await syncLocalScan(root)
    expect(Object.keys(first)).toEqual(["dir/a.jpg"])
    expect(syncConflictPath("dir/a.jpg")).toBe("dir/a.remote-conflict.jpg")
    expect(await syncLocalConflictList(root)).toEqual(["dir/a.remote-conflict.jpg"])
    const cachePath = join(root, ".assets-sync/hash-cache.json")
    const cache = JSON.parse(await readFile(cachePath, "utf8"))
    cache["dir/a.jpg"].sha256 = "a".repeat(64)
    await writeFile(cachePath, JSON.stringify(cache))
    const second = await syncLocalScan(root)
    expect(second["dir/a.jpg"]?.sha256).toBe("a".repeat(64))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("same-size edits within one timestamp second invalidate the cache even when mtime is restored", async () => {
  const root = await mkdtemp("/tmp/opencode/sync-scan-")
  try {
    const path = join(root, "original.txt")
    const second = 1793870000
    await writeFile(path, "aaaa")
    await utimes(path, second, second + 0.1)
    const first = await syncLocalScan(root)
    await writeFile(path, "bbbb")
    await utimes(path, second, second + 0.2)
    const secondScan = await syncLocalScan(root)
    expect(secondScan["original.txt"]?.sha256).not.toBe(first["original.txt"]?.sha256)
    await writeFile(path, "cccc")
    await utimes(path, second, second + 0.2)
    const third = await syncLocalScan(root)
    expect(third["original.txt"]?.mtimeMs).toBe(secondScan["original.txt"]?.mtimeMs)
    expect(third["original.txt"]?.sha256).not.toBe(secondScan["original.txt"]?.sha256)
    // A replacement inode must also invalidate a timestamp-preserving copy.
    await rm(path)
    await writeFile(path, "dddd")
    await utimes(path, second, second + 0.2)
    expect((await syncLocalScan(root))["original.txt"]?.sha256).not.toBe(third["original.txt"]?.sha256)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
