import type { Logger } from "./logger.js"
import { runRclone } from "./runRclone.js"

export async function listRemoteFiles(remotePath: string, cwd: string, logger?: Logger): Promise<string[]> {
  const output = await runRclone(["lsf", "--files-only", "--recursive", remotePath], cwd, logger)
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}
