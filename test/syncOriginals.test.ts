import { afterEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { SyncOriginalsOptions } from "../src/sync/SyncOriginalsOptions.js"
import { syncLocalCatalogRead } from "../src/sync/syncLocalCatalogRead.js"
import { syncLocalCatalogWrite } from "../src/sync/syncLocalCatalogWrite.js"
import { syncOriginals } from "../src/sync/syncOriginals.js"
import { syncRemoteCatalogRead } from "../src/sync/syncRemoteCatalogRead.js"
import { syncRemoteCatalogWrite } from "../src/sync/syncRemoteCatalogWrite.js"
import { syncRemoteList } from "../src/sync/syncRemoteList.js"

const roots: string[] = []
const now = () => new Date("2026-11-05T12:00:00.000Z")
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function fixture() {
  const root = await mkdtemp("/tmp/opencode/sync-originals-")
  roots.push(root)
  const remote = join(root, "remote")
  const a = join(root, "A")
  const b = join(root, "B")
  const c = join(root, "C")
  await mkdir(remote)
  const sync = (localDir: string, options: Partial<SyncOriginalsOptions> = {}) =>
    syncOriginals({ localDir, remotePath: remote, logLevel: 0, now, by: "test", ...options })
  return { root, remote, a, b, c, sync }
}

async function put(dir: string, path: string, text: string): Promise<void> {
  await mkdir(dirname(join(dir, path)), { recursive: true })
  await writeFile(join(dir, path), text)
}

const text = (dir: string, path: string) => readFile(join(dir, path), "utf8")
const exists = (dir: string, path: string) => Bun.file(join(dir, path)).exists()

async function trashContents(remote: string, path: string): Promise<string[]> {
  const dir = join(remote, ".assets-sync/trash/2026-11-05")
  const contents: string[] = []
  for (const slot of await readdir(dir)) {
    if (await exists(join(dir, slot), path)) contents.push(await text(join(dir, slot), path))
  }
  return contents
}

async function snapshot(dir: string): Promise<Record<string, string>> {
  const entries: Record<string, string> = {}
  async function walk(path: string): Promise<void> {
    for (const entry of await readdir(join(dir, path), { withFileTypes: true })) {
      const relative = join(path, entry.name)
      const info = await stat(join(dir, relative))
      entries[relative] = `${info.mtimeMs}:${entry.isDirectory() ? "directory" : await text(dir, relative)}`
      if (entry.isDirectory()) await walk(relative)
    }
  }
  await walk("")
  return entries
}

test("migration, three-machine propagation, tombstones, conflicts, external edits and history", async () => {
  const { root, remote, a, b, c, sync } = await fixture()
  await put(remote, "images/edit.txt", "original")
  await put(remote, "images/deleted.txt", "delete me")
  await put(remote, "untouched.txt", "stay")
  expect((await sync(a, { localDir: "A", remotePath: "remote", cwd: root })).catalogVersion).toBe(1)
  expect(await text(a, "images/edit.txt")).toBe("original")
  expect(await text(a, "images/deleted.txt")).toBe("delete me")
  expect(await text(a, "untouched.txt")).toBe("stay")
  expect((await sync(b)).catalogVersion).toBe(1)
  const initial = await syncRemoteCatalogRead(remote)
  expect(Object.values(initial!.files).every((file) => file.rev === 1)).toBe(true)

  await put(a, "images/edit.txt", "A updated this file")
  await put(a, "added.txt", "new on A")
  await rm(join(a, "images/deleted.txt"))
  const changed = await sync(a)
  expect(changed.catalogVersion).toBe(2)
  expect(changed.summary).toMatchObject({ uploads: 2, remoteDeletes: 1 })
  expect(await exists(b, "images/deleted.txt")).toBe(true)
  const pulled = await sync(b)
  expect(pulled.catalogVersion).toBe(2)
  expect(pulled.summary).toMatchObject({ downloads: 2, localDeletes: 1 })
  expect(await text(b, "images/edit.txt")).toBe("A updated this file")
  expect(await text(b, "added.txt")).toBe("new on A")
  expect(await exists(b, "images/deleted.txt")).toBe(false)
  expect(await trashContents(remote, "images/edit.txt")).toEqual(["original"])
  expect(await trashContents(remote, "images/deleted.txt")).toEqual(["delete me"])
  expect((await syncRemoteCatalogRead(remote))!.tombstones["images/deleted.txt"]!.rev).toBe(2)

  await put(c, "images/deleted.txt", "delete me")
  await put(c, "C-new.txt", "new on C")
  expect((await sync(c)).catalogVersion).toBe(3)
  expect(await exists(c, "images/deleted.txt")).toBe(false)
  expect(await text(remote, "C-new.txt")).toBe("new on C")
  await sync(a)
  await sync(b)

  await put(a, "images/edit.txt", "A wins first")
  await put(b, "images/edit.txt", "B chooses local resolution")
  expect((await sync(a)).catalogVersion).toBe(4)
  // A conflict on one path does not block the other paths: the same run uploads and
  // downloads everything else, commits a new catalog version, and quarantines edit.txt.
  await put(b, "b-only.txt", "uploads despite the conflict")
  await put(remote, "from-remote.txt", "external addition alongside the conflict")
  const conflicted = await sync(b)
  expect(conflicted.summary).toMatchObject({ conflicts: 1, uploads: 1, downloads: 1 })
  expect(conflicted.catalogVersion).toBe(5)
  expect(await text(b, "images/edit.remote-conflict.txt")).toBe("A wins first")
  expect(await text(b, "images/edit.txt")).toBe("B chooses local resolution")
  expect(await text(b, "from-remote.txt")).toBe("external addition alongside the conflict")
  expect(await text(remote, "b-only.txt")).toBe("uploads despite the conflict")
  expect((await syncRemoteCatalogRead(remote))!.files["images/edit.txt"]!.sha256).toBe(
    new Bun.CryptoHasher("sha256").update("A wins first").digest("hex"),
  )
  expect((await syncLocalCatalogRead(b))!.files["images/edit.txt"]).toEqual(
    (await syncRemoteCatalogRead(remote))!.files["images/edit.txt"],
  )
  const afterPartial = await snapshot(remote)
  // While the copy exists the path is re-reported, never auto-uploaded, and the remote is untouched.
  const quarantined = await sync(b)
  expect(quarantined.summary).toMatchObject({ conflicts: 1, uploads: 0, downloads: 0 })
  expect(await snapshot(remote)).toEqual(afterPartial)
  const beforeDryConflict = await snapshot(b)
  expect((await sync(b, { dryRun: true })).summary.conflicts).toBe(1)
  expect(await snapshot(b)).toEqual(beforeDryConflict)
  await rm(join(b, "images/edit.remote-conflict.txt"))
  expect((await sync(b)).catalogVersion).toBe(6)
  expect(await text(remote, "images/edit.txt")).toBe("B chooses local resolution")
  expect((await sync(a)).catalogVersion).toBe(6)
  expect(await text(a, "images/edit.txt")).toBe("B chooses local resolution")

  // Out-of-band additions, updates and deletions are adopted together in one revision.
  await put(remote, "external/nested.txt", "external addition")
  await put(remote, "images/edit.txt", "direct remote edit")
  await rm(join(remote, "added.txt"))
  const external = await sync(a)
  expect(external.catalogVersion).toBe(7)
  expect(external.summary).toMatchObject({ downloads: 2, localDeletes: 1, uploads: 0 })
  expect(await text(a, "external/nested.txt")).toBe("external addition")
  expect(await text(a, "images/edit.txt")).toBe("direct remote edit")
  expect(await exists(a, "added.txt")).toBe(false)
  expect((await sync(b)).catalogVersion).toBe(7)
  expect(await exists(b, "added.txt")).toBe(false)

  await put(remote, ".assets-sync/trash/2020-01-01/expired.txt", "expired")
  const catalogBeforeNoop = await text(remote, ".assets-sync/catalog.json")
  const history = await text(remote, ".assets-sync/changelog.jsonl")
  expect((await sync(a)).catalogVersion).toBe(7)
  expect(await exists(remote, ".assets-sync/trash/2020-01-01/expired.txt")).toBe(false)
  expect(await text(remote, ".assets-sync/catalog.json")).toBe(catalogBeforeNoop)
  expect(await text(remote, ".assets-sync/changelog.jsonl")).toBe(history)
  const lines = history
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
  expect(lines.map((line) => line.version)).toEqual([1, 1, 1, 2, 2, 2, 3, 4, 5, 5, 6, 7, 7, 7])
  expect(lines.every((line) => line.by === "test" && line.at === now().toISOString())).toBe(true)
  expect(await syncLocalCatalogRead(a)).toEqual(await syncRemoteCatalogRead(remote))
}, 120000)

test("dry runs make no local or remote writes, including migration, planned conflicts and pending deletes", async () => {
  const { root, remote, a, b, sync } = await fixture()
  await put(remote, "remote.txt", "remote")
  const remoteBefore = await snapshot(remote)
  expect((await sync(a, { dryRun: true })).summary.downloads).toBe(1)
  expect((await readdir(root)).sort()).toEqual(["remote"])
  expect(await snapshot(remote)).toEqual(remoteBefore)
  await sync(a)
  await sync(b)
  await put(a, "remote.txt", "local edit")
  await put(b, "remote.txt", "other edit")
  await sync(b)
  await put(a, "new.txt", "pending upload")
  const localBefore = await snapshot(a)
  const remoteWithCatalogBefore = await snapshot(remote)
  let hookCalled = false
  const dry = await sync(a, {
    dryRun: true,
    beforeCommit: async () => {
      hookCalled = true
    },
  })
  expect(dry.summary).toMatchObject({ conflicts: 1, uploads: 1 })
  expect(hookCalled).toBe(false)
  expect(await snapshot(a)).toEqual(localBefore)
  expect(await snapshot(remote)).toEqual(remoteWithCatalogBefore)
  expect(await exists(a, "remote.remote-conflict.txt")).toBe(false)

  await put(a, "remote.txt", "other edit")
  await sync(a)
  await rm(join(a, "new.txt"))
  await rm(join(remote, "remote.txt"))
  const localDeleteBefore = await snapshot(a)
  const remoteDeleteBefore = await snapshot(remote)
  expect((await sync(a, { dryRun: true })).summary).toMatchObject({ localDeletes: 1, remoteDeletes: 1 })
  expect(await snapshot(a)).toEqual(localDeleteBefore)
  expect(await snapshot(remote)).toEqual(remoteDeleteBefore)
}, 120000)

test("external conflicts can be acknowledged and resolved, including extensionless files and remote deletions", async () => {
  const { remote, a, sync } = await fixture()
  await put(remote, "LICENSE", "original")
  await sync(a)
  await put(a, "LICENSE", "local resolution")
  await put(remote, "LICENSE", "external change")
  const conflicted = await sync(a)
  expect(conflicted.summary).toMatchObject({ conflicts: 1, uploads: 0 })
  expect(conflicted.catalogVersion).toBe(1)
  expect(await text(a, "LICENSE.remote-conflict")).toBe("external change")
  expect(await text(a, "LICENSE")).toBe("local resolution")
  // While the copy exists the path is re-reported rather than auto-uploaded.
  const remoteBefore = await snapshot(remote)
  const quarantined = await sync(a)
  expect(quarantined.summary).toMatchObject({ conflicts: 1, uploads: 0 })
  expect(await snapshot(remote)).toEqual(remoteBefore)
  await rm(join(a, "LICENSE.remote-conflict"))
  expect((await sync(a)).catalogVersion).toBe(2)
  expect(await text(remote, "LICENSE")).toBe("local resolution")

  // A local edit wins over a remote deletion explicitly, in a single run.
  await put(a, "LICENSE", "re-add after external deletion")
  await rm(join(remote, "LICENSE"))
  const readded = await sync(a)
  expect(readded.summary).toMatchObject({ uploads: 1, conflicts: 0 })
  expect(readded.catalogVersion).toBe(3)
  expect(await text(remote, "LICENSE")).toBe("re-add after external deletion")

  // Checked-equal out-of-band content is adopted without a transfer.
  await put(remote, "equal.txt", "matching externally added contents")
  await put(a, "equal.txt", "matching externally added contents")
  const equal = await sync(a)
  expect(equal.catalogVersion).toBe(4)
  expect(equal.summary).toMatchObject({ uploads: 0, downloads: 0, conflicts: 0 })
}, 120000)

test("an optimistic version change retries the whole sync and preserves the other writer's entries", async () => {
  const { remote, a, sync } = await fixture()
  await put(remote, "existing.txt", "existing")
  await sync(a)
  await put(a, "mine.txt", "my edit")
  let calls = 0
  const result = await sync(a, {
    beforeCommit: async () => {
      calls++
      if (calls !== 1) return
      const concurrent = (await syncRemoteCatalogRead(remote))!
      // Another writer commits an unrelated addition after our transfer but before our commit.
      await put(remote, "concurrent.txt", "concurrent")
      const listing = (await syncRemoteList(remote))["concurrent.txt"]!
      const sha256 = new Bun.CryptoHasher("sha256").update("concurrent").digest("hex")
      concurrent.version++
      concurrent.files["concurrent.txt"] = {
        sha256,
        size: listing.size,
        remoteModTime: listing.modTime,
        rev: concurrent.version,
        updatedAt: now().toISOString(),
        updatedBy: "other",
      }
      await syncRemoteCatalogWrite(remote, concurrent)
    },
  })
  expect(calls).toBe(2)
  expect(result.catalogVersion).toBe(3)
  expect(await text(a, "concurrent.txt")).toBe("concurrent")
  const catalog = (await syncRemoteCatalogRead(remote))!
  expect(Object.keys(catalog.files).sort()).toEqual(["concurrent.txt", "existing.txt", "mine.txt"])
  expect(catalog.files["mine.txt"]!.rev).toBe(3)
  expect(catalog.files["concurrent.txt"]!.rev).toBe(2)
  expect(
    (await text(remote, ".assets-sync/changelog.jsonl"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line).version),
  ).toEqual([1, 3])
}, 120000)

test("optimistic retries are bounded to three attempts", async () => {
  const { remote, a, sync } = await fixture()
  let calls = 0
  await expect(
    sync(a, {
      beforeCommit: async () => {
        calls++
        const catalog = (await syncRemoteCatalogRead(remote)) ?? {
          schemaVersion: 1 as const,
          version: 0,
          files: {},
          tombstones: {},
          updatedAt: "",
          updatedBy: "",
        }
        catalog.version++
        await syncRemoteCatalogWrite(remote, catalog)
      },
    }),
  ).rejects.toThrow("all 3 sync attempts")
  expect(calls).toBe(3)
  expect(await syncLocalCatalogRead(a)).toBeNull()
}, 120000)

test("fresh-machine conflicts preserve pending paths and can resolve by keeping the remote copy", async () => {
  const { remote, a, sync } = await fixture()
  await put(remote, "conflict.txt", "remote choice")
  await put(remote, "download.txt", "still needs downloading")
  await put(a, "conflict.txt", "local differs")
  await put(a, "upload.txt", "still needs uploading")
  // The conflict quarantines conflict.txt while the other paths sync and commit in the same run.
  const conflicted = await sync(a)
  expect(conflicted.summary).toMatchObject({ conflicts: 1, downloads: 1, uploads: 1 })
  expect(conflicted.catalogVersion).toBe(1)
  expect(await text(a, "download.txt")).toBe("still needs downloading")
  expect(await text(remote, "upload.txt")).toBe("still needs uploading")
  expect(await text(a, "conflict.remote-conflict.txt")).toBe("remote choice")
  expect(await text(a, "conflict.txt")).toBe("local differs")
  expect(Object.keys((await syncRemoteCatalogRead(remote))!.files).sort()).toEqual(["download.txt", "upload.txt"])
  await put(a, "conflict.txt", await text(a, "conflict.remote-conflict.txt"))
  await rm(join(a, "conflict.remote-conflict.txt"))
  const result = await sync(a)
  // Converging adopts the previously uncatalogued remote contents without any transfer.
  expect(result.catalogVersion).toBe(2)
  expect(result.summary).toMatchObject({ downloads: 0, uploads: 0, conflicts: 0 })
  expect((await syncRemoteCatalogRead(remote))!.files["conflict.txt"]!.sha256).toBe(
    new Bun.CryptoHasher("sha256").update("remote choice").digest("hex"),
  )
  expect((await sync(a)).catalogVersion).toBe(2)
}, 120000)

test("a fresh populated machine restores a missing remote original unless a matching tombstone exists", async () => {
  const { remote, a, b, sync } = await fixture()
  await put(a, "original.txt", "only remaining copy")
  await sync(a)
  await put(b, "original.txt", "only remaining copy")
  await rm(join(remote, "original.txt"))
  const result = await sync(b)
  expect(result.summary).toMatchObject({ uploads: 1, localDeletes: 0, conflicts: 0 })
  expect(await text(b, "original.txt")).toBe("only remaining copy")
  expect(await text(remote, "original.txt")).toBe("only remaining copy")
}, 30000)

test("remote dotfiles, ignored directories and conflict copies stay untouched and do not break migration", async () => {
  const { remote, a, sync } = await fixture()
  const ignored = [".DS_Store", "ignore/old.jpg", "nested/discarded/original.jpg", "image.remote-conflict.jpg"]
  for (const path of ["original.jpg", ...ignored]) await put(remote, path, "preserve me")
  expect((await sync(a)).catalogVersion).toBe(1)
  expect(Object.keys((await syncRemoteCatalogRead(remote))!.files)).toEqual(["original.jpg"])
  for (const path of ignored) {
    expect(await exists(a, path)).toBe(false)
    expect(await text(remote, path)).toBe("preserve me")
  }
  expect((await sync(a)).catalogVersion).toBe(1)
}, 30000)

test("retries recover uploads and deletes interrupted before the remote catalog commit", async () => {
  const { remote, a, sync } = await fixture()
  const crash = async () => {
    throw new Error("simulated crash")
  }
  await put(a, "original.txt", "first version")
  await expect(sync(a, { beforeCommit: crash })).rejects.toThrow("simulated crash")
  expect(await syncRemoteCatalogRead(remote)).toBeNull()
  expect((await sync(a)).summary).toMatchObject({ uploads: 0, conflicts: 0 })
  expect((await syncRemoteCatalogRead(remote))!.version).toBe(1)

  await put(a, "original.txt", "updated original version")
  await expect(sync(a, { beforeCommit: crash })).rejects.toThrow("simulated crash")
  expect((await syncRemoteCatalogRead(remote))!.version).toBe(1)
  expect(await trashContents(remote, "original.txt")).toEqual(["first version"])
  expect((await sync(a)).summary).toMatchObject({ uploads: 0, conflicts: 0 })
  expect((await syncRemoteCatalogRead(remote))!.version).toBe(2)
  expect(await text(remote, "original.txt")).toBe("updated original version")

  await rm(join(a, "original.txt"))
  await expect(sync(a, { beforeCommit: crash })).rejects.toThrow("simulated crash")
  expect((await syncRemoteCatalogRead(remote))!.version).toBe(2)
  expect((await trashContents(remote, "original.txt")).sort()).toEqual(["first version", "updated original version"])
  expect((await sync(a)).summary.conflicts).toBe(0)
  expect((await syncRemoteCatalogRead(remote))!.tombstones["original.txt"]?.rev).toBe(3)
}, 30000)

test("edits win over deletions in a single run in both directions", async () => {
  const { remote, a, b, sync } = await fixture()
  await put(remote, "keep-edit.txt", "original")
  await put(remote, "keep-delete.txt", "original")
  await sync(a)
  await sync(b)
  // A deletes keep-edit locally while B edits it remotely: the edit downloads in one run.
  await rm(join(a, "keep-edit.txt"))
  await put(b, "keep-edit.txt", "B edited this file")
  expect((await sync(b)).catalogVersion).toBe(2)
  const downloadWins = await sync(a)
  expect(downloadWins.summary).toMatchObject({ downloads: 1, conflicts: 0 })
  expect(await text(a, "keep-edit.txt")).toBe("B edited this file")
  // B edits keep-delete locally while A deletes it remotely: the edit uploads in one run.
  await put(b, "keep-delete.txt", "B edited this file too")
  await rm(join(a, "keep-delete.txt"))
  expect((await sync(a)).catalogVersion).toBe(3)
  const uploadWins = await sync(b)
  expect(uploadWins.summary).toMatchObject({ uploads: 1, conflicts: 0 })
  expect(uploadWins.catalogVersion).toBe(4)
  expect(await text(remote, "keep-delete.txt")).toBe("B edited this file too")
  expect((await sync(a)).catalogVersion).toBe(4)
  expect(await text(a, "keep-delete.txt")).toBe("B edited this file too")
}, 120000)

test("prefer remote resolves conflicts and preserves the local loser in the local trash", async () => {
  const { remote, a, sync } = await fixture()
  await put(remote, "conflict.txt", "remote choice")
  await put(a, "conflict.txt", "local differs")
  const resolved = await sync(a, { prefer: "remote" })
  expect(resolved.summary).toMatchObject({ conflicts: 0, downloads: 1, uploads: 0 })
  expect(resolved.catalogVersion).toBe(1)
  expect(await text(a, "conflict.txt")).toBe("remote choice")
  expect(await text(a, ".assets-sync/trash/2026-11-05/conflict.txt")).toBe("local differs")
  expect((await sync(a)).catalogVersion).toBe(1)

  // Outstanding copies from an earlier run resolve the same way.
  await put(a, "conflict.txt", "A edit")
  await put(remote, "conflict.txt", "remote edit 2")
  const conflicted = await sync(a)
  expect(conflicted.summary).toMatchObject({ conflicts: 1, uploads: 0 })
  expect(conflicted.catalogVersion).toBe(1)
  expect(await text(a, "conflict.remote-conflict.txt")).toBe("remote edit 2")
  const resolvedAgain = await sync(a, { prefer: "remote" })
  expect(resolvedAgain.summary).toMatchObject({ conflicts: 0, uploads: 0, downloads: 0 })
  // Converging adopts the external edit without any transfer.
  expect(resolvedAgain.catalogVersion).toBe(2)
  expect(await text(a, "conflict.txt")).toBe("remote edit 2")
  expect(await exists(a, "conflict.remote-conflict.txt")).toBe(false)
  // Same-day repeat collisions keep both losers instead of overwriting the first.
  expect(await text(a, ".assets-sync/trash/2026-11-05/conflict.txt")).toBe("local differs")
  expect(await text(a, ".assets-sync/trash/2026-11-05/conflict.txt.1")).toBe("A edit")
}, 120000)

test("prefer local uploads conflicts and resolves outstanding copies by uploading", async () => {
  const { remote, a, b, sync } = await fixture()
  await expect(sync(a, { prefer: "bad" as unknown as "local" })).rejects.toThrow('prefer must be "local" or "remote"')
  await put(remote, "conflict.txt", "remote choice")
  await put(a, "conflict.txt", "local differs")
  const resolved = await sync(a, { prefer: "local" })
  expect(resolved.summary).toMatchObject({ conflicts: 0, uploads: 1 })
  expect(resolved.catalogVersion).toBe(1)
  expect(await text(remote, "conflict.txt")).toBe("local differs")
  expect(await trashContents(remote, "conflict.txt")).toEqual(["remote choice"])

  await sync(b)
  await put(a, "conflict.txt", "A edit")
  expect((await sync(a)).catalogVersion).toBe(2)
  await put(b, "conflict.txt", "B edit")
  expect((await sync(b)).summary.conflicts).toBe(1)
  const resolvedAgain = await sync(b, { prefer: "local" })
  expect(resolvedAgain.summary).toMatchObject({ conflicts: 0, uploads: 1 })
  expect(resolvedAgain.catalogVersion).toBe(3)
  expect(await text(remote, "conflict.txt")).toBe("B edit")
  expect(await exists(b, "conflict.remote-conflict.txt")).toBe(false)
}, 120000)

test("prefer local with an outstanding copy and no local file stays quarantined", async () => {
  const { remote, a, sync } = await fixture()
  await put(remote, "conflict.txt", "remote choice")
  await sync(a)
  await put(a, "conflict.txt", "local differs")
  await put(remote, "conflict.txt", "remote choice v2")
  const conflicted = await sync(a)
  expect(conflicted.summary).toMatchObject({ conflicts: 1 })
  expect(await exists(a, "conflict.remote-conflict.txt")).toBe(true)
  await rm(join(a, "conflict.txt"))
  const remoteBefore = await text(remote, "conflict.txt")
  const catalogBefore = await syncRemoteCatalogRead(remote)
  const result = await sync(a, { prefer: "local" })
  expect(result.summary).toMatchObject({ conflicts: 1, remoteDeletes: 0, uploads: 0, downloads: 0 })
  expect(await text(remote, "conflict.txt")).toBe(remoteBefore)
  expect(await exists(a, "conflict.remote-conflict.txt")).toBe(true)
  expect(await syncRemoteCatalogRead(remote)).toEqual(catalogBefore)
  expect(result.plan.find((entry) => entry.path === "conflict.txt")?.action).toBe("conflict")
})

test("prefer remote with an outstanding copy and no local file restores the copy", async () => {
  const { remote, a, sync } = await fixture()
  await put(remote, "conflict.txt", "remote choice")
  await sync(a)
  await put(a, "conflict.txt", "local differs")
  await put(remote, "conflict.txt", "remote choice v2")
  expect((await sync(a)).summary).toMatchObject({ conflicts: 1 })
  await rm(join(a, "conflict.txt"))
  const result = await sync(a, { prefer: "remote" })
  expect(result.summary).toMatchObject({ conflicts: 0 })
  expect(await text(a, "conflict.txt")).toBe("remote choice v2")
  expect(await exists(a, "conflict.remote-conflict.txt")).toBe(false)
  expect(await text(remote, "conflict.txt")).toBe("remote choice v2")
})

test("a remote commit followed by a failed local base write recovers without conflicting or retransferring", async () => {
  const { remote, a, sync } = await fixture()
  await put(a, "original.txt", "first version")
  await sync(a)
  const oldBase = (await syncLocalCatalogRead(a))!
  await put(a, "original.txt", "updated original version")
  const basePath = join(a, ".assets-sync/catalog.json")
  await expect(
    sync(a, {
      beforeCommit: async () => {
        await rm(basePath)
        await mkdir(basePath)
      },
    }),
  ).rejects.toThrow()
  expect((await syncRemoteCatalogRead(remote))!.version).toBe(2)
  await rm(basePath, { recursive: true })
  await syncLocalCatalogWrite(a, oldBase)
  expect((await sync(a)).summary).toMatchObject({ uploads: 0, downloads: 0, conflicts: 0 })
  expect(await syncLocalCatalogRead(a)).toEqual(await syncRemoteCatalogRead(remote))
  expect(await text(remote, "original.txt")).toBe("updated original version")
}, 30000)
