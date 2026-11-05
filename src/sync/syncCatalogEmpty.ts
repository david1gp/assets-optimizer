import type { SyncCatalog } from "./SyncCatalog.js"

export function syncCatalogEmpty(): SyncCatalog {
  return { schemaVersion: 1, version: 0, updatedAt: "", updatedBy: "", files: {}, tombstones: {} }
}
