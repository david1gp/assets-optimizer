import type { SyncPlan } from "./SyncPlan.js"

export interface SyncOriginalsResult {
  plan: SyncPlan
  summary: {
    uploads: number
    downloads: number
    localDeletes: number
    remoteDeletes: number
    conflicts: number
    unchanged: number
  }
  catalogVersion: number
}
