import fs from "node:fs/promises"
import { pathToFileURL } from "node:url"

export async function loadExistingAssetList<T>(filePath: string, exportName: string): Promise<Record<string, T>> {
  try {
    await fs.access(filePath)
  } catch {
    return {}
  }

  try {
    const moduleUrl = `${pathToFileURL(filePath).href}?t=${Date.now()}`
    const existingModule = (await import(moduleUrl)) as Record<string, unknown>
    const existingList = existingModule[exportName]
    return isRecord(existingList) ? (existingList as Record<string, T>) : {}
  } catch (error) {
    console.warn(`Failed to load existing ${exportName} from ${filePath}:`, error)
    return {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
