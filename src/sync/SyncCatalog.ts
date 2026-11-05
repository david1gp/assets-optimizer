import * as v from "valibot"

const counterSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0))
const sha256Schema = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))
const pathSchema = v.pipe(
  v.string(),
  v.check(
    (path) => !path.includes("\\") && path.split("/").every((part) => part !== "" && part !== "." && part !== ".."),
    "Expected a POSIX relative file path",
  ),
)

const syncCatalogFileSchema = v.strictObject({
  sha256: sha256Schema,
  size: counterSchema,
  remoteModTime: v.string(),
  rev: counterSchema,
  updatedAt: v.string(),
  updatedBy: v.string(),
})

const syncCatalogTombstoneSchema = v.strictObject({
  sha256: sha256Schema,
  rev: counterSchema,
  deletedAt: v.string(),
  deletedBy: v.string(),
})

export const syncCatalogSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    version: counterSchema,
    updatedAt: v.string(),
    updatedBy: v.string(),
    files: v.record(pathSchema, syncCatalogFileSchema),
    tombstones: v.record(pathSchema, syncCatalogTombstoneSchema),
  }),
  v.check(
    (catalog) =>
      Object.entries(catalog.files).every(
        ([path, file]) => file.rev <= catalog.version && !Object.hasOwn(catalog.tombstones, path),
      ) && Object.values(catalog.tombstones).every((entry) => entry.rev <= catalog.version),
    "Entry revisions must not exceed the catalog version and files cannot also be tombstones",
  ),
)

export type SyncCatalogFile = v.InferOutput<typeof syncCatalogFileSchema>
export type SyncCatalogTombstone = v.InferOutput<typeof syncCatalogTombstoneSchema>
export type SyncCatalog = v.InferOutput<typeof syncCatalogSchema>

export function syncCatalogParse(json: unknown): SyncCatalog {
  return v.parse(syncCatalogSchema, json)
}
