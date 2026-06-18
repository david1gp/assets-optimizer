import { isMissingDirError } from "./isMissingDirError.js"
import { walkFiles } from "./walkFiles.js"

export async function listLocalFiles(dir: string, ignoredDirNames: readonly string[] = []): Promise<string[]> {
  try {
    return await walkFiles(dir, ignoredDirNames)
  } catch (error) {
    if (isMissingDirError(error)) {
      return []
    }

    throw error
  }
}
