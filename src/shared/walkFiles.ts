import fs from "node:fs/promises"
import path from "node:path"
import { isIgnoredDir } from "./isIgnoredDir.js"

export async function walkFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (isIgnoredDir(entry.name)) {
        continue
      }
      files.push(...(await walkFiles(fullPath)))
      continue
    }

    if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}
