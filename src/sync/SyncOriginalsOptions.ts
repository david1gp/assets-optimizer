export interface SyncOriginalsOptions {
  localDir: string
  remotePath: string
  cwd?: string
  logLevel?: number
  dryRun?: boolean
  now?: () => Date
  by?: string
  trashRetentionDays?: number
  /**
   * Auto-resolve edit/edit conflicts instead of quarantining them: "local" uploads the local
   * file (the remote loser is kept by the upload backup-dir trash), "remote" downloads the
   * remote file after moving the losing local file to <localDir>/.assets-sync/trash/<date>/.
   */
  prefer?: "local" | "remote"
  /** Test seam for simulating another writer between execution and optimistic commit. */
  beforeCommit?: () => Promise<void>
}
