import type { SyncCatalog } from "./SyncCatalog.js"

export interface SyncLocalFile {
  sha256: string
  size: number
  mtimeMs: number
  ctimeMs?: number
  ino?: number
  dev?: number
}

export interface SyncRemoteFile {
  size: number
  modTime: string
}

export type SyncLocalFiles = Readonly<Record<string, SyncLocalFile>>
export type SyncRemoteListing = Readonly<Record<string, SyncRemoteFile>>
export type SyncPlanAction = "none" | "download" | "delete-local" | "upload" | "delete-remote" | "conflict"

export interface SyncPlanEntry {
  path: string
  action: SyncPlanAction
  reason: string
  // Retained for commit: a no-transfer equality can still require catalog adoption.
  remoteExternal: "add" | "update" | "delete" | null
}

export type SyncPlan = readonly SyncPlanEntry[]

export interface SyncPlanInput {
  remote: SyncCatalog
  base: SyncCatalog | null
  localFiles: SyncLocalFiles
  remoteListing: SyncRemoteListing
  // Only externally added/edited paths, checked against the current local contents by the caller.
  externalEqualLocal: ReadonlySet<string>
}
