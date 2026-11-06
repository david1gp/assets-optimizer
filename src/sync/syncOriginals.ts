import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, rename, rm, stat } from "node:fs/promises"
import { hostname } from "node:os"
import { dirname, join, resolve } from "node:path"
import { createLogger, type Logger } from "../shared/logger.js"
import type { SyncCatalog, SyncCatalogFile, SyncCatalogTombstone } from "./SyncCatalog.js"
import type { SyncOriginalsOptions } from "./SyncOriginalsOptions.js"
import type { SyncOriginalsResult } from "./SyncOriginalsResult.js"
import type { SyncLocalFiles, SyncPlan, SyncPlanAction, SyncPlanEntry, SyncRemoteListing } from "./SyncPlan.js"
import { syncCatalogApply } from "./syncCatalogApply.js"
import { syncCatalogEmpty } from "./syncCatalogEmpty.js"
import { syncConflictOriginal } from "./syncConflictOriginal.js"
import { syncConflictPath } from "./syncConflictPath.js"
import { syncLocalCatalogRead } from "./syncLocalCatalogRead.js"
import { syncLocalCatalogWrite } from "./syncLocalCatalogWrite.js"
import { syncLocalConflictList } from "./syncLocalConflictList.js"
import { syncLocalScan } from "./syncLocalScan.js"
import { syncPlanCreate } from "./syncPlanCreate.js"
import { syncRemoteCatalogRead } from "./syncRemoteCatalogRead.js"
import { syncRemoteCatalogWrite } from "./syncRemoteCatalogWrite.js"
import { syncRemoteChangelogAppend } from "./syncRemoteChangelogAppend.js"
import { syncRemoteCompare } from "./syncRemoteCompare.js"
import { syncRemoteDelete } from "./syncRemoteDelete.js"
import { syncRemoteDownload } from "./syncRemoteDownload.js"
import { syncRemoteDownloadFile } from "./syncRemoteDownloadFile.js"
import { syncRemoteList } from "./syncRemoteList.js"
import { syncRemoteTrashPurge } from "./syncRemoteTrashPurge.js"
import { syncRemoteUpload } from "./syncRemoteUpload.js"

const symbols: Record<SyncPlanAction, string> = {
  upload: "↑",
  download: "↓",
  "delete-local": "✕",
  "delete-remote": "✕",
  conflict: "⚠",
  none: "",
}

export async function syncOriginals(options: SyncOriginalsOptions): Promise<SyncOriginalsResult> {
  const logger = createLogger(options.logLevel)
  const localDir = resolve(options.cwd ?? process.cwd(), options.localDir)
  const remote = /^[^/]+:/.test(options.remotePath)
    ? options.remotePath.replace(/\/$/, "")
    : resolve(options.cwd ?? process.cwd(), options.remotePath)
  const by = options.by ?? hostname()
  const retention = options.trashRetentionDays ?? 30
  if (!Number.isFinite(retention) || retention < 0) throw new Error("trashRetentionDays must be non-negative")
  const prefer = options.prefer
  if (prefer !== undefined && prefer !== "local" && prefer !== "remote")
    throw new Error('prefer must be "local" or "remote"')
  if (!options.dryRun) await mkdir(join(localDir, ".assets-sync"), { recursive: true })

  for (let attempt = 0; attempt < 3; attempt++) {
    const now = (options.now ?? (() => new Date()))()
    const at = now.toISOString()
    const date = at.slice(0, 10)
    const remoteCatalog = (await syncRemoteCatalogRead(remote)) ?? syncCatalogEmpty()
    const remoteListing = await syncRemoteList(remote)
    if (prefer && !options.dryRun) {
      await preferResolveOutstanding({ localDir, remoteListing, prefer, date, logger })
    }
    const base = await syncLocalCatalogRead(localDir)
    const localFiles = await syncLocalScan(localDir, [], { writeCache: false })
    const externalPaths = Object.keys(remoteListing).filter((path) => {
      const file = remoteCatalog.files[path]
      const listed = remoteListing[path]!
      return localFiles[path] && (!file || file.size !== listed.size || file.remoteModTime !== listed.modTime)
    })
    const externalEqualLocal = await syncRemoteCompare(localDir, remote, externalPaths)
    let plan = quarantineOutstanding(
      syncPlanCreate({ remote: remoteCatalog, base, localFiles, remoteListing, externalEqualLocal }),
      await syncLocalConflictList(localDir),
    )
    let preferTrashed: string[] = []
    if (prefer) {
      const resolved = preferResolvePlan(plan, prefer, localFiles, remoteListing, logger)
      plan = resolved.plan
      preferTrashed = resolved.trashed
    }
    for (const entry of plan) {
      if (entry.action !== "none") logger.files(`${symbols[entry.action]} ${entry.action} ${entry.path}`)
    }
    const result = resultCreate(plan, remoteCatalog.version)
    if (options.dryRun) {
      summaryLog(result)
      return result
    }

    // Conflicts quarantine a single path: every other entry executes and commits as usual.
    const conflicts = plan.filter((entry) => entry.action === "conflict")
    const acknowledged = new Map<string, { file?: SyncCatalogFile; tombstone?: SyncCatalogTombstone }>()
    for (const { path } of conflicts) {
      acknowledged.set(path, await quarantineConflict(remote, localDir, remoteCatalog, remoteListing, path, at, by))
    }

    // Prefer-remote losers are preserved in the local trash before the remote contents overwrite them.
    for (const path of preferTrashed) await trashLocalFile(localDir, path, date)
    const executable = plan.filter((entry) => entry.action !== "conflict")
    const paths = (action: SyncPlanAction) =>
      executable.filter((entry) => entry.action === action).map((entry) => entry.path)
    await syncRemoteDownload(remote, localDir, paths("download"))
    for (const path of paths("delete-local")) await rm(join(localDir, path), { force: true })
    const uploads = paths("upload")
    await syncRemoteUpload(localDir, remote, uploads, date)
    await syncRemoteDelete(remote, paths("delete-remote"), date)
    const postListing = uploads.length ? await syncRemoteList(remote) : remoteListing
    const postLocal = await syncLocalScan(localDir, [], { writeCache: false })
    const applied = syncCatalogApply({
      remote: remoteCatalog,
      plan: executable,
      localFiles: postLocal,
      remoteListing: postListing,
      by,
      now: at,
    })

    await options.beforeCommit?.()
    const current = await syncRemoteCatalogRead(remote)
    if ((current?.version ?? 0) !== remoteCatalog.version) {
      logger.warn("⚠ Remote catalog changed; retrying sync")
      continue
    }
    if (applied.changelog.length) {
      await syncRemoteCatalogWrite(remote, applied.catalog)
      await syncRemoteChangelogAppend(
        remote,
        applied.changelog.map((line) => JSON.stringify(line)),
      )
    }
    // The local base is the newly applied catalog, except conflicted paths keep their
    // acknowledged remote entries so a later resolution behaves like the classic flow:
    // deleting the copy uploads local, replacing local with the copy converges to remote.
    // The remote catalog itself keeps the conflicted paths untouched.
    const nextBase: SyncCatalog = structuredClone(applied.catalog)
    for (const [path, ack] of acknowledged) {
      delete nextBase.files[path]
      delete nextBase.tombstones[path]
      if (ack.file) nextBase.files[path] = ack.file
      else if (ack.tombstone) nextBase.tombstones[path] = ack.tombstone
    }
    await syncLocalCatalogWrite(localDir, nextBase)
    await syncLocalScan(localDir)
    await syncRemoteTrashPurge(remote, retention, now)
    result.catalogVersion = applied.catalog.version
    for (const { path } of conflicts) {
      logger.warn(
        `⚠ Sync conflict at ${path}: local file kept as-is, remote contents saved to ${syncConflictPath(path)}. ` +
          "To keep local, delete the copy and sync again; to keep remote, replace the local file with the " +
          "copy, delete the copy, and sync again.",
      )
    }
    summaryLog(result)
    return result
  }
  throw new Error("Remote catalog changed during all 3 sync attempts; retry when other writers have finished")

  function summaryLog(result: SyncOriginalsResult): void {
    const { uploads, downloads, localDeletes, remoteDeletes, conflicts } = result.summary
    logger.summary(
      `${options.dryRun ? "Dry run: " : ""}↑ ${uploads} ↓ ${downloads} ✕ ${localDeletes} local / ${remoteDeletes} remote ⚠ ${conflicts} · catalog v${result.catalogVersion}`,
    )
  }
}

function quarantineOutstanding(plan: SyncPlan, copies: readonly string[]): SyncPlanEntry[] {
  const originals = new Map<string, string>()
  const orphans: string[] = []
  for (const copy of copies) {
    const original = syncConflictOriginal(copy)
    if (original) originals.set(original, copy)
    else orphans.push(copy)
  }
  const next: SyncPlanEntry[] = plan.map((entry) =>
    originals.has(entry.path)
      ? {
          ...entry,
          action: "conflict" as const,
          reason:
            `Unresolved remote conflict copy at ${syncConflictPath(entry.path)}; ` +
            "delete it to keep local, or replace local with it to keep remote",
        }
      : entry,
  )
  for (const [original, copy] of originals) {
    if (next.some((entry) => entry.path === original)) continue
    next.push({
      path: original,
      action: "conflict",
      reason: `Unresolved remote conflict copy at ${copy}; delete it to keep local, or replace local with it to keep remote`,
      remoteExternal: null,
    })
  }
  for (const copy of orphans) {
    next.push({
      path: copy,
      action: "conflict",
      reason: `Unresolved remote conflict copy at ${copy}; remove it and sync again`,
      remoteExternal: null,
    })
  }
  return next.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

async function quarantineConflict(
  remote: string,
  localDir: string,
  remoteCatalog: SyncCatalog,
  remoteListing: SyncRemoteListing,
  path: string,
  at: string,
  by: string,
): Promise<{ file?: SyncCatalogFile; tombstone?: SyncCatalogTombstone }> {
  const listed = Object.hasOwn(remoteListing, path) ? remoteListing[path] : undefined
  if (listed) {
    const copy = join(localDir, syncConflictPath(path))
    await mkdir(dirname(copy), { recursive: true })
    await syncRemoteDownloadFile(`${remote}/${path}`, copy)
    // For an out-of-band edit, the catalog hash is stale; acknowledge the downloaded contents instead.
    const hash = createHash("sha256")
    for await (const chunk of createReadStream(copy)) hash.update(chunk)
    const file = Object.hasOwn(remoteCatalog.files, path) ? remoteCatalog.files[path] : undefined
    return {
      file: {
        sha256: hash.digest("hex"),
        size: listed.size,
        remoteModTime: listed.modTime,
        rev: file?.rev ?? remoteCatalog.version,
        updatedAt: file?.updatedAt ?? at,
        updatedBy: file?.updatedBy ?? by,
      },
    }
  }
  const tombstone = Object.hasOwn(remoteCatalog.tombstones, path) ? remoteCatalog.tombstones[path] : undefined
  if (tombstone) return { tombstone }
  const file = Object.hasOwn(remoteCatalog.files, path) ? remoteCatalog.files[path] : undefined
  if (file) return { tombstone: { sha256: file.sha256, rev: remoteCatalog.version, deletedAt: at, deletedBy: by } }
  return {}
}

function preferResolvePlan(
  plan: SyncPlanEntry[],
  prefer: "local" | "remote",
  localFiles: SyncLocalFiles,
  remoteListing: SyncRemoteListing,
  logger: Logger,
): { plan: SyncPlanEntry[]; trashed: string[] } {
  const trashed: string[] = []
  const next = plan.map((entry): SyncPlanEntry => {
    if (entry.action !== "conflict") return entry
    const local = Object.hasOwn(localFiles, entry.path) ? localFiles[entry.path] : undefined
    const listed = Object.hasOwn(remoteListing, entry.path) ? remoteListing[entry.path] : undefined
    if (prefer === "local") {
      // Nothing local to upload: keep quarantined rather than destroying the remote side.
      if (!local) return entry
      logger.warn(
        `⚠ Auto-resolved conflict at ${entry.path} preferring local: uploading (remote backup kept in remote trash)`,
      )
      return { ...entry, action: "upload", reason: "Auto-resolved conflict preferring local over remote contents" }
    }
    if (listed) {
      if (local) trashed.push(entry.path)
      logger.warn(
        `⚠ Auto-resolved conflict at ${entry.path} preferring remote: downloading` +
          (local ? " (losing local file moved to .assets-sync/trash/)" : ""),
      )
      return { ...entry, action: "download", reason: "Auto-resolved conflict preferring remote over local contents" }
    }
    if (!local) return { ...entry, action: "none", reason: "Both sides deleted" }
    trashed.push(entry.path)
    logger.warn(
      `⚠ Auto-resolved conflict at ${entry.path} preferring remote deletion (losing local file moved to .assets-sync/trash/)`,
    )
    return {
      ...entry,
      action: "delete-local",
      reason: "Auto-resolved conflict preferring the remote deletion over local contents",
    }
  })
  return { plan: next, trashed }
}

async function preferResolveOutstanding(args: {
  localDir: string
  remoteListing: SyncRemoteListing
  prefer: "local" | "remote"
  date: string
  logger: Logger
}): Promise<void> {
  const { localDir, remoteListing, prefer, date, logger } = args
  for (const copy of await syncLocalConflictList(localDir)) {
    const original = syncConflictOriginal(copy)
    if (!original) continue
    if (prefer === "local") {
      // Nothing local to upload: leave the copy in place so the path stays quarantined.
      if (!(await localFileExists(join(localDir, original)))) {
        logger.warn(
          `⚠ Outstanding conflict at ${original} has no local file: leaving ${copy} quarantined ` +
            "rather than deleting the remote side",
        )
        continue
      }
      // Delete the copy and let the acknowledged-base semantics upload local in this run.
      await rm(join(localDir, copy), { force: true })
      logger.warn(`⚠ Auto-resolved outstanding conflict at ${original} preferring local: removed ${copy}`)
      continue
    }
    const localFile = join(localDir, original)
    const hadLocal = await localFileExists(localFile)
    if (hadLocal) await trashLocalFile(localDir, original, date)
    if (Object.hasOwn(remoteListing, original)) {
      // Restore the remote contents from the copy, then drop the copy: the path converges to remote.
      await mkdir(dirname(localFile), { recursive: true })
      await rename(join(localDir, copy), localFile)
    } else {
      await rm(join(localDir, copy), { force: true })
    }
    logger.warn(
      `⚠ Auto-resolved outstanding conflict at ${original} preferring remote` +
        (hadLocal ? ` (losing local file moved to .assets-sync/trash/${date}/${original})` : ""),
    )
  }
}

async function trashLocalFile(localDir: string, path: string, date: string): Promise<void> {
  // Same-day repeats keep every loser: never overwrite an earlier trash entry.
  const base = join(localDir, ".assets-sync/trash", date, path)
  let trashPath = base
  for (let suffix = 1; await localFileExists(trashPath); suffix++) trashPath = `${base}.${suffix}`
  await mkdir(dirname(trashPath), { recursive: true })
  await rename(join(localDir, path), trashPath)
}

async function localFileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

function resultCreate(plan: SyncPlan, catalogVersion: number): SyncOriginalsResult {
  const count = (action: SyncPlanAction) => plan.filter((entry) => entry.action === action).length
  return {
    plan,
    summary: {
      uploads: count("upload"),
      downloads: count("download"),
      localDeletes: count("delete-local"),
      remoteDeletes: count("delete-remote"),
      conflicts: count("conflict"),
      unchanged: count("none"),
    },
    catalogVersion,
  }
}
