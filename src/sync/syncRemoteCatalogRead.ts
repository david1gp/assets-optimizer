import { type SyncCatalog, syncCatalogParse } from "./SyncCatalog.js"
import { syncRemoteReadOptional } from "./syncRemoteReadOptional.js"

export async function syncRemoteCatalogRead(remote: string): Promise<SyncCatalog | null> {
  const text = await syncRemoteReadOptional(`${remote}/.assets-sync/catalog.json`)
  return text === null ? null : syncCatalogParse(JSON.parse(text))
}
