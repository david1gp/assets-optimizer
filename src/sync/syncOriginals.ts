import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import { hostname } from "node:os"
import { join, resolve } from "node:path"
import { createLogger } from "../shared/logger.js"
import type { SyncCatalog } from "./SyncCatalog.js"
import type { SyncOriginalsOptions } from "./SyncOriginalsOptions.js"
import type { SyncOriginalsResult } from "./SyncOriginalsResult.js"
import type { SyncPlan, SyncPlanAction } from "./SyncPlan.js"
import { syncCatalogApply } from "./syncCatalogApply.js"
import { syncCatalogEmpty } from "./syncCatalogEmpty.js"
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
  const outstanding = await syncLocalConflictList(localDir)
  if (outstanding.length && !options.dryRun) throw conflictError(outstanding)
  if (!options.dryRun) await mkdir(join(localDir, ".assets-sync"), { recursive: true })

  for (let attempt = 0; attempt < 3; attempt++) {
    const now = (options.now ?? (() => new Date()))()
    const at = now.toISOString()
    const date = at.slice(0, 10)
    const remoteCatalog = (await syncRemoteCatalogRead(remote)) ?? syncCatalogEmpty()
    const base = await syncLocalCatalogRead(localDir)
    const localFiles = await syncLocalScan(localDir, [], { writeCache: false })
    const remoteListing = await syncRemoteList(remote)
    const externalPaths = Object.keys(remoteListing).filter((path) => {
      const file = remoteCatalog.files[path]
      const listed = remoteListing[path]!
      return localFiles[path] && (!file || file.size !== listed.size || file.remoteModTime !== listed.modTime)
    })
    const externalEqualLocal = await syncRemoteCompare(localDir, remote, externalPaths)
    const plan: SyncPlan = [
      ...syncPlanCreate({ remote: remoteCatalog, base, localFiles, remoteListing, externalEqualLocal }),
      ...outstanding.map((path) => ({
        path,
        action: "conflict" as const,
        reason: "Unresolved remote conflict copy; resolve and remove this file",
        remoteExternal: null,
      })),
    ]
    for (const entry of plan) {
      if (entry.action !== "none") logger.files(`${symbols[entry.action]} ${entry.action} ${entry.path}`)
    }
    const result = resultCreate(plan, remoteCatalog.version)
    if (options.dryRun) {
      summaryLog(result)
      return result
    }

    const conflicts = plan.filter((entry) => entry.action === "conflict")
    if (conflicts.length) {
      // Preserve the old base for all non-conflicting paths: they have not been executed yet.
      const acknowledged: SyncCatalog = structuredClone(base ?? syncCatalogEmpty())
      acknowledged.version = remoteCatalog.version
      for (const { path } of conflicts) {
        const listed = remoteListing[path]
        delete acknowledged.files[path]
        delete acknowledged.tombstones[path]
        if (listed) {
          const copy = join(localDir, syncConflictPath(path))
          await syncRemoteDownloadFile(`${remote}/${path}`, copy)
          // For an out-of-band edit, R's hash is stale; acknowledge the downloaded contents instead.
          const hash = createHash("sha256")
          for await (const chunk of createReadStream(copy)) hash.update(chunk)
          acknowledged.files[path] = {
            sha256: hash.digest("hex"),
            size: listed.size,
            remoteModTime: listed.modTime,
            rev: remoteCatalog.files[path]?.rev ?? remoteCatalog.version,
            updatedAt: remoteCatalog.files[path]?.updatedAt ?? at,
            updatedBy: remoteCatalog.files[path]?.updatedBy ?? by,
          }
        } else {
          const tombstone = remoteCatalog.tombstones[path]
          if (tombstone) acknowledged.tombstones[path] = tombstone
          else if (remoteCatalog.files[path]) {
            acknowledged.tombstones[path] = {
              sha256: remoteCatalog.files[path]!.sha256,
              rev: remoteCatalog.version,
              deletedAt: at,
              deletedBy: by,
            }
          }
        }
      }
      await syncLocalCatalogWrite(localDir, acknowledged)
      summaryLog(result)
      throw conflictError(conflicts.map(({ path }) => path))
    }

    const paths = (action: SyncPlanAction) => plan.filter((entry) => entry.action === action).map((entry) => entry.path)
    await syncRemoteDownload(remote, localDir, paths("download"))
    for (const path of paths("delete-local")) await rm(join(localDir, path), { force: true })
    const uploads = paths("upload")
    await syncRemoteUpload(localDir, remote, uploads, date)
    await syncRemoteDelete(remote, paths("delete-remote"), date)
    const postListing = uploads.length ? await syncRemoteList(remote) : remoteListing
    const postLocal = await syncLocalScan(localDir, [], { writeCache: false })
    const applied = syncCatalogApply({
      remote: remoteCatalog,
      plan,
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
    await syncLocalCatalogWrite(localDir, applied.catalog)
    await syncLocalScan(localDir)
    await syncRemoteTrashPurge(remote, retention, now)
    result.catalogVersion = applied.catalog.version
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

function conflictError(paths: string[]): Error {
  return new Error(
    `Unresolved sync conflicts:\n${paths.map((path) => `⚠ ${path}`).join("\n")}\n` +
      "Keep your local file to upload it, or replace it with the .remote-conflict copy to keep remote contents. " +
      "For a remote deletion, remove the local file to accept it. Remove all .remote-conflict files, then run sync again.",
  )
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
