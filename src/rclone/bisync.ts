import fs from "node:fs/promises"
import { dirExists } from "../shared/dirExists.js"
import { runRclone } from "./runRclone.js"

export interface BisyncOptions {
  cwd?: string
  resync?: boolean
}

/**
 * https://rclone.org/bisync/#limitations
 */
export async function bisync(localPath: string, remotePath: string, options: BisyncOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd()
  const localDirExists = await dirExists(localPath)

  await fs.mkdir(localPath, { recursive: true })
  await runRclone(["mkdir", remotePath], cwd)

  const args = [
    "bisync",
    localPath,
    remotePath,
    "--create-empty-src-dirs",
    "--resilient",
    "--recover",
  ]
  if (options.resync === true || !localDirExists) {
    args.push("--resync")
  }

  await runRclone(args, cwd)
}
