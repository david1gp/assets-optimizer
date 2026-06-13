import { walkFiles } from "./walkFiles.js"

export async function isLocalDirEmpty(dir: string): Promise<boolean> {
  try {
    const files = await walkFiles(dir)
    return files.length === 0
  } catch {
    return true
  }
}
