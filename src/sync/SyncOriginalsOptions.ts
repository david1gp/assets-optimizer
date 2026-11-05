export interface SyncOriginalsOptions {
  localDir: string
  remotePath: string
  cwd?: string
  logLevel?: number
  dryRun?: boolean
  now?: () => Date
  by?: string
  trashRetentionDays?: number
  /** Test seam for simulating another writer between execution and optimistic commit. */
  beforeCommit?: () => Promise<void>
}
