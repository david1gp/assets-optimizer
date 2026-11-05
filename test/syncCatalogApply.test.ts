import { describe, expect, test } from "bun:test"
import { type SyncCatalog, syncCatalogParse } from "../src/sync/SyncCatalog.js"
import type { SyncPlan, SyncPlanEntry } from "../src/sync/SyncPlan.js"
import { type SyncCatalogApplyInput, syncCatalogApply } from "../src/sync/syncCatalogApply.js"
import { syncCatalogEmpty } from "../src/sync/syncCatalogEmpty.js"
import { syncPlanCreate } from "../src/sync/syncPlanCreate.js"

const oldHash = "a".repeat(64)
const newHash = "b".repeat(64)
const now = "2026-11-05T10:00:00.000Z"
const by = "machine-one"
const file = (sha256 = oldHash) => ({
  sha256,
  size: 1,
  remoteModTime: "old",
  rev: 4,
  updatedAt: "then",
  updatedBy: "other",
})
const remote = (): SyncCatalog => ({ ...syncCatalogEmpty(), version: 4, files: { photo: file() } })
const entry = (
  action: SyncPlanEntry["action"],
  path = "photo",
  remoteExternal: SyncPlanEntry["remoteExternal"] = null,
): SyncPlanEntry => ({ path, action, remoteExternal, reason: "test" })
const apply = (plan: SyncPlan, overrides: Partial<SyncCatalogApplyInput> = {}) =>
  syncCatalogApply({ remote: remote(), plan, localFiles: {}, remoteListing: {}, by, now, ...overrides })

describe("syncCatalogApply", () => {
  test.each(["none", "download", "delete-local"] as const)("tracked %s does not edit the catalog", (action) => {
    const original =
      action === "delete-local"
        ? {
            ...remote(),
            files: {},
            tombstones: { photo: { sha256: oldHash, rev: 4, deletedAt: "then", deletedBy: "other" } },
          }
        : remote()
    const result = apply([entry(action)], { remote: original })
    expect(result.catalog).toBe(original)
    expect(result.changelog).toEqual([])
  })

  test("uploads record actual post-upload metadata and preserve unrelated entries", () => {
    const original = remote()
    original.files.untouched = file()
    const before = JSON.stringify(original)
    const result = apply([entry("upload")], {
      remote: original,
      localFiles: { photo: { sha256: newHash, size: 2, mtimeMs: 123 } },
      remoteListing: { photo: { size: 2, modTime: "uploaded" } },
    })
    expect(result.catalog.version).toBe(5)
    expect(result.catalog.updatedAt).toBe(now)
    expect(result.catalog.updatedBy).toBe(by)
    expect(result.catalog.files.photo).toEqual({
      sha256: newHash,
      size: 2,
      remoteModTime: "uploaded",
      rev: 5,
      updatedAt: now,
      updatedBy: by,
    })
    expect(result.catalog.files.untouched).toBe(original.files.untouched)
    expect(result.changelog).toEqual([{ version: 5, at: now, by, op: "update", path: "photo", sha256: newHash }])
    expect(JSON.stringify(original)).toBe(before)
    expect(syncCatalogParse(result.catalog)).toEqual(result.catalog)
  })

  test("adds files and removes tombstones when re-added", () => {
    const original: SyncCatalog = {
      ...remote(),
      files: {},
      tombstones: { photo: { sha256: oldHash, rev: 4, deletedAt: "then", deletedBy: "other" } },
    }
    const result = apply([entry("upload")], {
      remote: original,
      localFiles: { photo: { sha256: newHash, size: 1, mtimeMs: 1 } },
      remoteListing: { photo: { size: 1, modTime: "uploaded" } },
    })
    expect(result.catalog.tombstones).toEqual({})
    expect(result.catalog.files.photo?.rev).toBe(5)
    expect(result.changelog[0]?.op).toBe("add")
  })

  test("local delete creates a tombstone with the last known hash", () => {
    const result = apply([entry("delete-remote")])
    expect(result.catalog.files).toEqual({})
    expect(result.catalog.tombstones.photo).toEqual({ sha256: oldHash, rev: 5, deletedAt: now, deletedBy: by })
    expect(result.changelog).toEqual([{ version: 5, at: now, by, op: "delete", path: "photo", sha256: oldHash }])
  })

  test.each(["download", "none"] as const)("external add is adopted after %s", (action) => {
    const original = syncCatalogEmpty()
    const result = apply([entry(action, "photo", "add")], {
      remote: original,
      localFiles: { photo: { sha256: newHash, size: 1, mtimeMs: 1 } },
      remoteListing: { photo: { size: 1, modTime: "external" } },
    })
    expect(result.catalog.files.photo).toEqual({
      sha256: newHash,
      size: 1,
      remoteModTime: "external",
      rev: 1,
      updatedAt: now,
      updatedBy: by,
    })
    expect(result.changelog[0]).toMatchObject({ version: 1, op: "add", sha256: newHash })
  })

  test.each(["download", "none"] as const)(
    "external edit uses the post-download/local checked hash after %s",
    (action) => {
      const result = apply([entry(action, "photo", "update")], {
        localFiles: { photo: { sha256: newHash, size: 1, mtimeMs: 1 } },
        remoteListing: { photo: { size: 1, modTime: "external" } },
      })
      expect(result.catalog.files.photo?.sha256).toBe(newHash)
      expect(result.catalog.files.photo?.remoteModTime).toBe("external")
      expect(result.changelog[0]?.op).toBe("update")
    },
  )

  test("external metadata-only edit is still a catalog change", () => {
    const result = apply([entry("none", "photo", "update")], {
      localFiles: { photo: { sha256: oldHash, size: 1, mtimeMs: 1 } },
      remoteListing: { photo: { size: 1, modTime: "external" } },
    })
    expect(result.catalog.version).toBe(5)
    expect(result.changelog[0]?.op).toBe("update")
  })

  test("external re-add clears an existing tombstone even without a transfer", () => {
    const original: SyncCatalog = {
      ...remote(),
      files: {},
      tombstones: { photo: { sha256: oldHash, rev: 4, deletedAt: "then", deletedBy: "other" } },
    }
    const input: SyncCatalogApplyInput = {
      remote: original,
      plan: [entry("none", "photo", "add")],
      localFiles: { photo: { sha256: newHash, size: 1, mtimeMs: 1 } },
      remoteListing: { photo: { size: 1, modTime: "external" } },
      by,
      now,
    }
    const before = JSON.stringify(input)
    const result = syncCatalogApply(input)
    expect(result.catalog.tombstones).toEqual({})
    expect(result.catalog.files.photo?.sha256).toBe(newHash)
    expect(result.changelog[0]?.op).toBe("add")
    expect(syncCatalogApply(input)).toEqual(result)
    expect(JSON.stringify(input)).toBe(before)
  })

  test.each(["delete-local", "none"] as const)("external delete is adopted after %s", (action) => {
    const result = apply([entry(action, "photo", "delete")])
    expect(result.catalog.files).toEqual({})
    expect(result.catalog.tombstones.photo?.sha256).toBe(oldHash)
    expect(result.changelog[0]?.op).toBe("delete")
  })

  test("fresh re-add over an external deletion commits the upload, not a tombstone", () => {
    const result = apply([entry("upload", "photo", "delete")], {
      localFiles: { photo: { sha256: newHash, size: 1, mtimeMs: 1 } },
      remoteListing: { photo: { size: 1, modTime: "uploaded" } },
    })
    expect(result.catalog.files.photo?.sha256).toBe(newHash)
    expect(result.catalog.tombstones).toEqual({})
    expect(result.changelog).toHaveLength(1)
  })

  test("multiple changes increment the global counter once, with deterministic changelog order", () => {
    const original = remote()
    original.files.deleted = file()
    const result = apply([entry("upload", "new"), entry("upload"), entry("delete-remote", "deleted")], {
      remote: original,
      localFiles: { photo: { sha256: newHash, size: 1, mtimeMs: 1 }, new: { sha256: newHash, size: 1, mtimeMs: 1 } },
      remoteListing: { photo: { size: 1, modTime: "uploaded" }, new: { size: 1, modTime: "uploaded" } },
    })
    expect(result.catalog.version).toBe(5)
    expect(result.catalog.files.photo?.rev).toBe(5)
    expect(result.catalog.files.new?.rev).toBe(5)
    expect(result.catalog.tombstones.deleted?.rev).toBe(5)
    expect(result.changelog.map((line) => [line.path, line.version, line.op])).toEqual([
      ["deleted", 5, "delete"],
      ["new", 5, "add"],
      ["photo", 5, "update"],
    ])
  })

  test("a repeated converged sync does not increment the version", () => {
    const localFiles = { photo: { sha256: newHash, size: 1, mtimeMs: 1 } }
    const remoteListing = { photo: { size: 1, modTime: "uploaded" } }
    const first = apply([entry("upload")], { localFiles, remoteListing })
    const plan = syncPlanCreate({
      remote: first.catalog,
      base: first.catalog,
      localFiles,
      remoteListing,
      externalEqualLocal: new Set(),
    })
    const second = syncCatalogApply({ remote: first.catalog, plan, localFiles, remoteListing, by, now })
    expect(second.catalog).toBe(first.catalog)
    expect(second.changelog).toEqual([])
  })

  test("same upload metadata and an empty plan leave the original catalog unchanged", () => {
    const original = remote()
    expect(apply([], { remote: original }).catalog).toBe(original)
    const result = apply([entry("upload")], {
      remote: original,
      localFiles: { photo: { sha256: oldHash, size: 1, mtimeMs: 1 } },
      remoteListing: { photo: { size: 1, modTime: "old" } },
    })
    expect(result.catalog).toBe(original)
    expect(result.changelog).toEqual([])
  })

  test("refuses conflict plans and incomplete post-execution metadata", () => {
    expect(() => apply([entry("conflict")])).toThrow("conflicts")
    expect(() => apply([entry("upload")])).toThrow("Missing post-execution")
    expect(() => apply([entry("download", "photo", "update")])).toThrow("Missing post-execution")
    expect(() =>
      apply([entry("upload")], {
        localFiles: { photo: { sha256: oldHash, size: 1, mtimeMs: 1 } },
        remoteListing: { photo: { size: 2, modTime: "uploaded" } },
      }),
    ).toThrow("sizes differ")
  })
})
