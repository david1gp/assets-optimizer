export interface SyncResolveFileReport {
  exists: boolean
  size?: number
  /** ISO-8601 modification time of the file on disk. */
  mtime?: string
  /** First 12 hex characters of the SHA-256 contents hash. */
  sha256?: string
  width?: number
  height?: number
  /** Image format reported by image-size (for example "png"). */
  format?: string
}

export interface SyncResolveRemoteReport extends SyncResolveFileReport {
  /** Remote-side metadata from the local base catalog, when present. */
  updatedAt?: string
  updatedBy?: string
}

export type SyncResolveAction = "listed" | "kept-local" | "kept-remote" | "kept-both" | "error"

export interface SyncResolveConflict {
  /** Original path, or the copy path itself for an orphan copy with no mappable original. */
  path: string
  copyPath: string
  orphan: boolean
  local: SyncResolveFileReport
  remote: SyncResolveRemoteReport
  /** Set when both sides decoded as images via sharp: whether the raw pixels match. */
  pixels?: "identical" | "differ"
  action: SyncResolveAction
  /** For kept-both: the .remote-copy sibling the copy was renamed to. */
  targetPath?: string
  note?: string
  error?: string
}

export interface SyncResolveResult {
  conflicts: SyncResolveConflict[]
  summary: {
    total: number
    resolved: number
    failed: number
    listed: number
  }
}
