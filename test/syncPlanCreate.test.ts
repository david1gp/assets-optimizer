import { describe, expect, test } from "bun:test"
import { type SyncCatalog, syncCatalogParse } from "../src/sync/SyncCatalog.js"
import type { SyncLocalFiles, SyncPlanAction, SyncPlanInput, SyncRemoteListing } from "../src/sync/SyncPlan.js"
import { syncCatalogEmpty } from "../src/sync/syncCatalogEmpty.js"
import { syncPlanCreate } from "../src/sync/syncPlanCreate.js"

const path = "images/photo.png"
const hash = (value: string) => value.repeat(64)
const local = (value?: string): SyncLocalFiles =>
  value ? { [path]: { sha256: hash(value), size: 1, mtimeMs: 10 } } : {}
const catalog = (value?: string, rev = 1, deleted = false): SyncCatalog => ({
  ...syncCatalogEmpty(),
  version: rev,
  files:
    value && !deleted
      ? { [path]: { sha256: hash(value), size: 1, remoteModTime: "old", rev, updatedAt: "then", updatedBy: "other" } }
      : {},
  tombstones: value && deleted ? { [path]: { sha256: hash(value), rev, deletedAt: "then", deletedBy: "other" } } : {},
})
const listing = (remote: SyncCatalog): SyncRemoteListing =>
  Object.fromEntries(
    Object.entries(remote.files).map(([key, file]) => [key, { size: file.size, modTime: file.remoteModTime }]),
  )

interface Case {
  name: string
  base: SyncCatalog | null
  remote: SyncCatalog
  local?: string
  action: SyncPlanAction
  remoteListing?: SyncRemoteListing
  equal?: boolean
  external?: "add" | "update" | "delete"
}

const cases: Case[] = [
  { name: "unchanged file", base: catalog("a"), remote: catalog("a"), local: "a", action: "none" },
  { name: "remote-only add", base: catalog(), remote: catalog("a", 2), action: "download" },
  { name: "remote-only update", base: catalog("a"), remote: catalog("b", 2), local: "a", action: "download" },
  { name: "remote-only delete", base: catalog("a"), remote: catalog("a", 2, true), local: "a", action: "delete-local" },
  { name: "local-only add", base: catalog(), remote: catalog(), local: "a", action: "upload" },
  { name: "local-only update", base: catalog("a"), remote: catalog("a"), local: "b", action: "upload" },
  { name: "local-only delete", base: catalog("a"), remote: catalog("a"), action: "delete-remote" },
  { name: "both add the same content", base: catalog(), remote: catalog("a", 2), local: "a", action: "none" },
  { name: "both update to the same content", base: catalog("a"), remote: catalog("b", 2), local: "b", action: "none" },
  { name: "both delete", base: catalog("a"), remote: catalog("a", 2, true), action: "none" },
  { name: "both add different content", base: catalog(), remote: catalog("a", 2), local: "b", action: "conflict" },
  { name: "both update differently", base: catalog("a"), remote: catalog("b", 2), local: "c", action: "conflict" },
  { name: "local delete versus remote update", base: catalog("a"), remote: catalog("b", 2), action: "conflict" },
  {
    name: "remote delete versus local update",
    base: catalog("a"),
    remote: catalog("a", 2, true),
    local: "b",
    action: "conflict",
  },
  {
    name: "remote re-add versus local re-add",
    base: catalog("a", 1, true),
    remote: catalog("b", 2),
    local: "c",
    action: "conflict",
  },
  {
    name: "local re-add after known tombstone",
    base: catalog("a", 1, true),
    remote: catalog("a", 1, true),
    local: "a",
    action: "upload",
  },
  { name: "fresh matching file", base: null, remote: catalog("a"), local: "a", action: "none" },
  { name: "fresh differing file", base: null, remote: catalog("a"), local: "b", action: "conflict" },
  { name: "fresh local-only file", base: null, remote: catalog(), local: "a", action: "upload" },
  { name: "fresh matching tombstone", base: null, remote: catalog("a", 2, true), local: "a", action: "delete-local" },
  { name: "fresh differing tombstone", base: null, remote: catalog("a", 2, true), local: "b", action: "upload" },
  { name: "fresh remote-only file", base: null, remote: catalog("a"), action: "download" },
  { name: "fresh tombstone only", base: null, remote: catalog("a", 2, true), action: "none" },
  { name: "known tombstone stays deleted", base: catalog("a", 2, true), remote: catalog("a", 2, true), action: "none" },
  {
    name: "external add without local",
    base: catalog(),
    remote: catalog(),
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    action: "download",
    external: "add",
  },
  {
    name: "external add equals local",
    base: catalog(),
    remote: catalog(),
    local: "a",
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    equal: true,
    action: "none",
    external: "add",
  },
  {
    name: "external add differs from local",
    base: catalog(),
    remote: catalog(),
    local: "a",
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    action: "conflict",
    external: "add",
  },
  {
    name: "external edit without local edits",
    base: catalog("a"),
    remote: catalog("a"),
    local: "a",
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    action: "download",
    external: "update",
  },
  {
    name: "external edit equals unmodified local",
    base: catalog("a"),
    remote: catalog("a"),
    local: "a",
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    equal: true,
    action: "none",
    external: "update",
  },
  {
    name: "external edit equals edited local",
    base: catalog("a"),
    remote: catalog("a"),
    local: "b",
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    equal: true,
    action: "none",
    external: "update",
  },
  {
    name: "external edit differs from edited local",
    base: catalog("a"),
    remote: catalog("a"),
    local: "b",
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    action: "conflict",
    external: "update",
  },
  {
    name: "external edit versus local delete",
    base: catalog("a"),
    remote: catalog("a"),
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    action: "conflict",
    external: "update",
  },
  {
    name: "external size change alone",
    base: catalog("a"),
    remote: catalog("a"),
    local: "a",
    remoteListing: { [path]: { size: 2, modTime: "old" } },
    action: "download",
    external: "update",
  },
  {
    name: "external delete with unchanged local",
    base: catalog("a"),
    remote: catalog("a"),
    local: "a",
    remoteListing: {},
    action: "delete-local",
    external: "delete",
  },
  {
    name: "external delete with edited local",
    base: catalog("a"),
    remote: catalog("a"),
    local: "b",
    remoteListing: {},
    action: "conflict",
    external: "delete",
  },
  {
    name: "external delete with deleted local",
    base: catalog("a"),
    remote: catalog("a"),
    remoteListing: {},
    action: "none",
    external: "delete",
  },
  {
    name: "fresh external add only",
    base: null,
    remote: catalog(),
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    action: "download",
    external: "add",
  },
  {
    name: "fresh external add equal",
    base: null,
    remote: catalog(),
    local: "a",
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    equal: true,
    action: "none",
    external: "add",
  },
  {
    name: "fresh external add differs",
    base: null,
    remote: catalog(),
    local: "a",
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    action: "conflict",
    external: "add",
  },
  {
    name: "fresh external edit only",
    base: null,
    remote: catalog("a"),
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    action: "download",
    external: "update",
  },
  {
    name: "fresh external edit equal",
    base: null,
    remote: catalog("a"),
    local: "b",
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    equal: true,
    action: "none",
    external: "update",
  },
  {
    name: "fresh external edit does not trust old hash",
    base: null,
    remote: catalog("a"),
    local: "a",
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    action: "conflict",
    external: "update",
  },
  {
    name: "fresh missing remote file preserves matching local without a tombstone",
    base: null,
    remote: catalog("a"),
    local: "a",
    remoteListing: {},
    action: "upload",
    external: "delete",
  },
  {
    name: "fresh external delete changed local",
    base: null,
    remote: catalog("a"),
    local: "b",
    remoteListing: {},
    action: "upload",
    external: "delete",
  },
  {
    name: "fresh external delete without local",
    base: null,
    remote: catalog("a"),
    remoteListing: {},
    action: "none",
    external: "delete",
  },
  {
    name: "acknowledged external edit allows local conflict resolution",
    base: {
      ...catalog("b"),
      files: { [path]: { ...catalog("b").files[path]!, remoteModTime: "new" } },
    },
    remote: catalog("a"),
    local: "c",
    remoteListing: { [path]: { size: 1, modTime: "new" } },
    action: "upload",
    external: "update",
  },
  {
    name: "acknowledged external deletion allows local re-add resolution",
    base: catalog("a", 1, true),
    remote: catalog("a"),
    local: "b",
    remoteListing: {},
    action: "upload",
    external: "delete",
  },
  {
    name: "external deletion of an unknown remote file still conflicts with local addition",
    base: catalog(),
    remote: catalog("a", 2),
    local: "b",
    remoteListing: {},
    action: "conflict",
    external: "delete",
  },
]

describe("syncPlanCreate", () => {
  test.each(cases)("$name", (item) => {
    const input: SyncPlanInput = {
      remote: item.remote,
      base: item.base,
      localFiles: local(item.local),
      remoteListing: item.remoteListing ?? listing(item.remote),
      externalEqualLocal: new Set(item.equal ? [path] : []),
    }
    const before = JSON.stringify(input)
    const plan = syncPlanCreate(input)
    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({ path, action: item.action, remoteExternal: item.external ?? null })
    expect(plan[0]?.reason.length).toBeGreaterThan(0)
    expect(JSON.stringify(input)).toBe(before)
    expect(syncPlanCreate(input)).toEqual(plan)
  })

  test("uses per-path revisions rather than global version or hashes", () => {
    const base = catalog("a")
    const remote = { ...base, version: 20 }
    expect(
      syncPlanCreate({
        remote,
        base,
        localFiles: local("a"),
        remoteListing: listing(remote),
        externalEqualLocal: new Set(),
      })[0]?.action,
    ).toBe("none")
    remote.files = { [path]: { ...base.files[path]!, rev: 20 } }
    expect(
      syncPlanCreate({
        remote,
        base,
        localFiles: local("b"),
        remoteListing: listing(remote),
        externalEqualLocal: new Set(),
      })[0]?.action,
    ).toBe("conflict")
  })

  test("returns paths in deterministic order and handles completely empty inputs", () => {
    const input: SyncPlanInput = {
      remote: syncCatalogEmpty(),
      base: null,
      localFiles: {},
      remoteListing: {},
      externalEqualLocal: new Set(),
    }
    expect(syncPlanCreate(input)).toEqual([])
    input.localFiles = { z: { sha256: hash("a"), size: 1, mtimeMs: 1 }, a: { sha256: hash("b"), size: 1, mtimeMs: 1 } }
    expect(syncPlanCreate(input).map((entry) => entry.path)).toEqual(["a", "z"])
  })
})

describe("syncCatalogParse", () => {
  test("parses empty catalogs, files and tombstones", () => {
    expect(syncCatalogParse(syncCatalogEmpty())).toEqual(syncCatalogEmpty())
    expect(syncCatalogParse(catalog("a"))).toEqual(catalog("a"))
    expect(syncCatalogParse(catalog("a", 2, true))).toEqual(catalog("a", 2, true))
  })

  test.each([
    null,
    {},
    { ...syncCatalogEmpty(), schemaVersion: 2 },
    { ...syncCatalogEmpty(), version: -1 },
    { ...syncCatalogEmpty(), version: 0.5 },
    { ...catalog("a"), version: 0 },
    { ...catalog("a"), tombstones: catalog("a", 1, true).tombstones },
    { ...catalog("a"), files: { "../escape": catalog("a").files[path] } },
    { ...catalog("a"), files: { [path]: { ...catalog("a").files[path], sha256: "invalid" } } },
    { ...syncCatalogEmpty(), unexpected: true },
  ])("rejects invalid catalog %#", (value) => {
    expect(() => syncCatalogParse(value)).toThrow()
  })
})
