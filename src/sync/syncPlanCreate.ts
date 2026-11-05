import type { SyncPlan, SyncPlanEntry, SyncPlanInput } from "./SyncPlan.js"

export function syncPlanCreate(input: SyncPlanInput): SyncPlan {
  const { remote, base, localFiles, remoteListing, externalEqualLocal } = input
  const paths = new Set([
    ...Object.keys(remote.files),
    ...Object.keys(remote.tombstones),
    ...Object.keys(base?.files ?? {}),
    ...Object.keys(base?.tombstones ?? {}),
    ...Object.keys(localFiles),
    ...Object.keys(remoteListing),
  ])

  return [...paths].sort().map((path): SyncPlanEntry => {
    const local = Object.hasOwn(localFiles, path) ? localFiles[path] : undefined
    const listed = Object.hasOwn(remoteListing, path) ? remoteListing[path] : undefined
    const file = Object.hasOwn(remote.files, path) ? remote.files[path] : undefined
    const tombstone = Object.hasOwn(remote.tombstones, path) ? remote.tombstones[path] : undefined
    const remoteExternal = listed
      ? !file
        ? "add"
        : file.size !== listed.size || file.remoteModTime !== listed.modTime
          ? "update"
          : null
      : file
        ? "delete"
        : null
    const entry = (action: SyncPlanEntry["action"], reason: string): SyncPlanEntry => ({
      path,
      action,
      reason,
      remoteExternal,
    })
    // Listing presence is authoritative. Never use a stale catalog hash for external edits;
    // only a caller-verified comparison can establish equality with local contents.
    const equal = listed
      ? !!local && (remoteExternal ? externalEqualLocal.has(path) : local.sha256 === file?.sha256)
      : !local

    if (!base) {
      if (listed) {
        if (!local) return entry("download", "Remote file is missing locally")
        if (equal) return entry("none", "Local and remote contents match")
        return entry("conflict", "Fresh local and remote contents differ")
      }
      if (!local) return entry("none", "File is absent on both sides")
      // A missing listing is not a committed deletion. On a fresh machine only a
      // matching tombstone authorizes deleting an original (including after a crash).
      if (local.sha256 === tombstone?.sha256) {
        return entry("delete-local", "Local contents match the remotely deleted file")
      }
      return entry("upload", "Local file is new or re-added after deletion")
    }

    const baseFile = Object.hasOwn(base.files, path) ? base.files[path] : undefined
    const baseTombstone = Object.hasOwn(base.tombstones, path) ? base.tombstones[path] : undefined
    const localChanged = local?.sha256 !== baseFile?.sha256
    // Compare both entry kind and revision: a file and tombstone may have the same rev.
    // A conflict acknowledgement may already describe an external edit not yet committed to R.
    // Compare that acknowledged metadata to the listing rather than conflicting forever on R's stale entry.
    const remoteChanged = remoteExternal
      ? listed
        ? !baseFile ||
          baseFile.size !== listed.size ||
          baseFile.remoteModTime !== listed.modTime ||
          (!!file && file.rev !== baseFile.rev)
        : !baseTombstone || baseTombstone.sha256 !== file?.sha256 || baseTombstone.rev < (file?.rev ?? 0)
      : !!file !== !!baseFile ||
        !!tombstone !== !!baseTombstone ||
        file?.rev !== baseFile?.rev ||
        tombstone?.rev !== baseTombstone?.rev

    if (!localChanged && !remoteChanged) return entry("none", "Neither side changed")
    // Includes both deleted, same hash, and externally changed but checked-equal content.
    if (equal) return entry("none", "Both sides have the same final contents")
    if (localChanged && remoteChanged) return entry("conflict", "Both sides changed to different contents")
    if (remoteChanged) {
      return listed ? entry("download", "Only remote changed") : entry("delete-local", "Only remote deleted")
    }
    return local ? entry("upload", "Only local changed") : entry("delete-remote", "Only local deleted")
  })
}
