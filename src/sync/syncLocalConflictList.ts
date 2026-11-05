import { readdir } from "node:fs/promises"
import { join, posix } from "node:path"
import { isConflictFile } from "../shared/isConflictFile.js"

export async function syncLocalConflictList(localDir: string): Promise<string[]> {
  const paths: string[] = []
  async function walk(relative: string): Promise<void> {
    const entries = await readdir(join(localDir, relative), { withFileTypes: true }).catch((error) => {
      if (relative === "" && (error as NodeJS.ErrnoException).code === "ENOENT") return []
      throw error
    })
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue
      const path = posix.join(relative, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile() && isConflictFile(entry.name)) paths.push(path)
    }
  }
  await walk("")
  return paths.sort()
}
