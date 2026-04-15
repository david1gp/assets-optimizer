import { isMissingDirError } from "./isMissingDirError.js"
import { walkFiles } from "./walkFiles.js"

export async function listLocalFiles(dir: string): Promise<string[]> {
  try {
    return await walkFiles(dir)
  } catch (error) {
    if (isMissingDirError(error)) {
      return []
    }

    throw error
  }
}
