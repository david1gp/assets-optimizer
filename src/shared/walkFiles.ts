import fs from "node:fs/promises"
import path from "node:path"
import { isIgnoredDir } from "./isIgnoredDir.js"

export async function walkFiles(dir: string, ignoredDirNames: readonly string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (isIgnoredDir(entry.name, ignoredDirNames)) {
        continue
      }
      files.push(...(await walkFiles(fullPath, ignoredDirNames)))
      continue
    }

    if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}
