import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { type SyncCatalog, syncCatalogParse } from "./SyncCatalog.js"

export async function syncLocalCatalogRead(localDir: string): Promise<SyncCatalog | null> {
  try {
    return syncCatalogParse(JSON.parse(await readFile(join(localDir, ".assets-sync/catalog.json"), "utf8")))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}
