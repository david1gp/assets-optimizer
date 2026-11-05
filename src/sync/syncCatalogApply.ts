import type { SyncCatalog } from "./SyncCatalog.js"
import type { SyncLocalFiles, SyncPlan, SyncRemoteListing } from "./SyncPlan.js"

export interface SyncCatalogApplyInput {
  remote: SyncCatalog
  plan: SyncPlan
  // Post-execution scan: includes hashes for external files just downloaded.
  localFiles: SyncLocalFiles
  // Original listing with uploaded paths replaced by their post-upload size/modTime.
  remoteListing: SyncRemoteListing
  by: string
  now: string
}

export interface SyncChangelogLine {
  version: number
  at: string
  by: string
  op: "add" | "update" | "delete"
  path: string
  sha256?: string
}

export interface SyncCatalogApplyResult {
  catalog: SyncCatalog
  changelog: SyncChangelogLine[]
}

export function syncCatalogApply(input: SyncCatalogApplyInput): SyncCatalogApplyResult {
  const { remote, plan, localFiles, remoteListing, by, now } = input
  if (plan.some((entry) => entry.action === "conflict")) {
    throw new Error("Cannot commit a sync plan containing conflicts")
  }
  const version = remote.version + 1
  const files: SyncCatalog["files"] = Object.assign(Object.create(null), remote.files)
  const tombstones: SyncCatalog["tombstones"] = Object.assign(Object.create(null), remote.tombstones)
  const changelog: SyncChangelogLine[] = []

  for (const entry of [...plan].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    const { path, action, remoteExternal } = entry
    const previous = Object.hasOwn(remote.files, path) ? remote.files[path] : undefined
    if (action === "delete-remote" || (remoteExternal === "delete" && action !== "upload")) {
      if (!previous) continue
      delete files[path]
      tombstones[path] = { sha256: previous.sha256, rev: version, deletedAt: now, deletedBy: by }
      changelog.push({ version, at: now, by, op: "delete", path, sha256: previous.sha256 })
      continue
    }

    // Tracked downloads/deletes merely bring this machine up to date, not a new catalog edit.
    // External checked-equal (none) paths, however, must adopt their actual metadata/hash.
    if (action !== "upload" && remoteExternal !== "add" && remoteExternal !== "update") continue
    const local = Object.hasOwn(localFiles, path) ? localFiles[path] : undefined
    const listed = Object.hasOwn(remoteListing, path) ? remoteListing[path] : undefined
    if (!local || !listed) throw new Error(`Missing post-execution file information for ${path}`)
    if (local.size !== listed.size) throw new Error(`Local and remote sizes differ for ${path}`)
    if (
      previous?.sha256 === local.sha256 &&
      previous.size === listed.size &&
      previous.remoteModTime === listed.modTime
    ) {
      continue
    }
    files[path] = {
      sha256: local.sha256,
      size: listed.size,
      remoteModTime: listed.modTime,
      rev: version,
      updatedAt: now,
      updatedBy: by,
    }
    delete tombstones[path]
    changelog.push({ version, at: now, by, op: previous ? "update" : "add", path, sha256: local.sha256 })
  }

  if (changelog.length === 0) return { catalog: remote, changelog }
  return { catalog: { ...remote, version, updatedAt: now, updatedBy: by, files, tombstones }, changelog }
}
