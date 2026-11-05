import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { SyncCatalog } from "./SyncCatalog.js"

export async function syncLocalCatalogWrite(localDir: string, catalog: SyncCatalog): Promise<void> {
  const dir = join(localDir, ".assets-sync")
  await mkdir(dir, { recursive: true })
  const temp = join(dir, `catalog.${crypto.randomUUID()}.tmp`)
  try {
    await writeFile(temp, `${JSON.stringify(catalog, null, 2)}\n`)
    await rename(temp, join(dir, "catalog.json"))
  } finally {
    await rm(temp, { force: true })
  }
}
