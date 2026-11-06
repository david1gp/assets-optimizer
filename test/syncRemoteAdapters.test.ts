import { afterEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { syncCatalogEmpty } from "../src/sync/syncCatalogEmpty.js"
import { syncLocalCatalogRead } from "../src/sync/syncLocalCatalogRead.js"
import { syncLocalCatalogWrite } from "../src/sync/syncLocalCatalogWrite.js"
import { syncRemoteCatalogRead } from "../src/sync/syncRemoteCatalogRead.js"
import { syncRemoteCatalogWrite } from "../src/sync/syncRemoteCatalogWrite.js"
import { syncRemoteChangelogAppend } from "../src/sync/syncRemoteChangelogAppend.js"
import { syncRemoteCompare } from "../src/sync/syncRemoteCompare.js"
import { syncRemoteDelete } from "../src/sync/syncRemoteDelete.js"
import { syncRemoteDownload } from "../src/sync/syncRemoteDownload.js"
import { syncRemoteDownloadFile } from "../src/sync/syncRemoteDownloadFile.js"
import { syncRemoteList } from "../src/sync/syncRemoteList.js"
import { syncRemoteTrashPurge } from "../src/sync/syncRemoteTrashPurge.js"
import { syncRemoteUpload } from "../src/sync/syncRemoteUpload.js"

const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

test("catalog, changelog, transfer, compare, trash and purge work with local rclone remotes", async () => {
  const root = await mkdtemp("/tmp/opencode/sync-test-")
  roots.push(root)
  const local = join(root, "local")
  const remote = join(root, "remote")
  await mkdir(local)
  await mkdir(remote)
  const catalog = syncCatalogEmpty()
  expect(await syncRemoteCatalogRead(remote)).toBeNull()
  expect(await syncLocalCatalogRead(local)).toBeNull()
  await syncRemoteCatalogWrite(remote, catalog)
  await syncLocalCatalogWrite(local, catalog)
  expect(await syncRemoteCatalogRead(remote)).toEqual(catalog)
  expect(await syncLocalCatalogRead(local)).toEqual(catalog)
  await syncRemoteChangelogAppend(remote, ['{"v":1}'])
  await syncRemoteChangelogAppend(remote, ['{"v":2}'])
  expect(await readFile(join(remote, ".assets-sync/changelog.jsonl"), "utf8")).toBe('{"v":1}\n{"v":2}\n')
  const path = "dir/é space.txt"
  await mkdir(join(local, "dir"))
  await mkdir(join(remote, "dir"))
  await writeFile(join(remote, path), "old")
  await writeFile(join(local, path), "new content")
  expect(Object.keys(await syncRemoteList(remote))).toEqual([path])
  expect((await syncRemoteCompare(local, remote, [path])).size).toBe(0)
  await syncRemoteUpload(local, remote, [path], "2020-01-01")
  const oldTrash = join(
    remote,
    ".assets-sync/trash/2020-01-01",
    (await readdir(join(remote, ".assets-sync/trash/2020-01-01")))[0]!,
  )
  expect(await readFile(join(oldTrash, path), "utf8")).toBe("old")
  expect(await syncRemoteCompare(local, remote, [path])).toEqual(new Set([path]))
  await syncRemoteDelete(remote, [path], "2026-11-01")
  const newTrash = join(
    remote,
    ".assets-sync/trash/2026-11-01",
    (await readdir(join(remote, ".assets-sync/trash/2026-11-01")))[0]!,
  )
  expect(await readFile(join(newTrash, path), "utf8")).toBe("new content")
  await syncRemoteTrashPurge(remote, 30, new Date("2026-11-05T00:00:00Z"))
  expect(await Bun.file(join(oldTrash, path)).exists()).toBe(false)
  expect(await Bun.file(join(newTrash, path)).exists()).toBe(true)
  await syncRemoteDownload(newTrash, local, [path])
  await syncRemoteDownloadFile(join(newTrash, path), join(local, "conflict copy"))
  expect(await readFile(join(local, "conflict copy"), "utf8")).toBe("new content")
})

test("an empty remote catalog file reads as missing, like B2 cat of a nonexistent object", async () => {
  const root = await mkdtemp("/tmp/opencode/sync-test-")
  roots.push(root)
  const remote = join(root, "remote")
  // B2/S3 `rclone cat` of a missing object exits 0 with zero bytes instead of
  // failing; a zero-byte catalog object is the local equivalent of that result.
  await mkdir(join(remote, ".assets-sync"), { recursive: true })
  await writeFile(join(remote, ".assets-sync/catalog.json"), "")
  expect(await syncRemoteCatalogRead(remote)).toBeNull()
})

test("repeated same-day uploads and deletes preserve every previous original in separate trash slots", async () => {
  const root = await mkdtemp("/tmp/opencode/sync-trash-")
  roots.push(root)
  const local = join(root, "local")
  const remote = join(root, "remote")
  await mkdir(local)
  await mkdir(remote)
  await writeFile(join(remote, "file.txt"), "aaaa")
  for (const content of ["bbbb", "cccc"]) {
    await writeFile(join(local, "file.txt"), content)
    await syncRemoteUpload(local, remote, ["file.txt"], "2026-11-05")
    expect(await readFile(join(remote, "file.txt"), "utf8")).toBe(content)
  }
  await syncRemoteDelete(remote, ["file.txt"], "2026-11-05")
  await writeFile(join(remote, "file.txt"), "dddd")
  await syncRemoteDelete(remote, ["file.txt"], "2026-11-05")
  const trash = join(remote, ".assets-sync/trash/2026-11-05")
  const contents = await Promise.all(
    (await readdir(trash)).map((slot) => readFile(join(trash, slot, "file.txt"), "utf8")),
  )
  expect(contents.sort()).toEqual(["aaaa", "bbbb", "cccc", "dddd"])
  expect(await Bun.file(join(remote, "file.txt")).exists()).toBe(false)
})
