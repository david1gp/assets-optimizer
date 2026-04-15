import { runRclone } from "./runRclone.js"

export async function listRemoteFiles(remotePath: string, cwd: string): Promise<string[]> {
  const output = await runRclone(["lsf", "--files-only", "--recursive", remotePath], cwd)
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}
