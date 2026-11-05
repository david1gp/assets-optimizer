import type { SyncCatalog } from "./SyncCatalog.js"
import { syncRemoteRun } from "./syncRemoteRun.js"

export async function syncRemoteCatalogWrite(remote: string, catalog: SyncCatalog): Promise<void> {
  await syncRemoteRun(["rcat", `${remote}/.assets-sync/catalog.json`], `${JSON.stringify(catalog, null, 2)}\n`)
}
