export type SyncResolveKeep = "local" | "remote" | "both"

export interface SyncResolveOptions {
  localDir: string
  cwd?: string
  /**
   * Which side to keep. Without it the command only lists outstanding conflicts
   * and changes nothing: "local" deletes the .remote-conflict copy (the next sync
   * uploads local via ack semantics), "remote" replaces the local file with the copy
   * contents and deletes the copy (the next sync is a no-op for that path), "both"
   * renames the copy to a .remote-copy sibling that syncs as a normal original.
   */
  keep?: SyncResolveKeep
  /** Original paths to resolve. Defaults to all outstanding conflicts. */
  paths?: readonly string[]
}
