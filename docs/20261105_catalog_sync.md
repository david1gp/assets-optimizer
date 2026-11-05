# Catalog-based originals sync (replace rclone bisync)

## Goal

Replace `rclone bisync` in `processAssets()` with a robust, stateless-per-machine sync for originals
(images, videos, fonts) where the **originals remote (B2 / Google Drive) is the single source of truth**.
No per-machine rclone state, no `--resync`, no silent data loss, works on fresh machines.
Optimized outputs (R2) must never be wiped because of incomplete local state.

## Decisions

- Remote catalog (`<originalsRemote>/.assets-sync/catalog.json`) is the source of truth, with a **global
  monotonic `version` counter** (edit counter). Every committed change increments it once per sync run.
- Every file entry and tombstone stores `rev` = catalog version in which it last changed.
  Change detection per path: `remoteChanged = remoteEntry.rev !== baseEntry.rev` (or presence differs).
- Local base (`<originalsDir>/.assets-sync/catalog.json`) = copy of the remote catalog as of this machine's last
  successful sync. `local.version === remote.version` → this machine is up to date with the remote.
- Assumption: no offline edits; edits are synced promptly. Still, conflicts are detected, never overwritten.
- Conflict policy: **keep both, stop.** Remote version is downloaded as `<name>.remote-conflict.<ext>`,
  the local base entry for that path is set to the remote entry (acknowledged), sync exits non-zero.
  Next run: if the user kept local → local differs from base → uploaded (local wins). If the user replaced
  local with the conflict copy → equal to remote → nothing. Sync refuses to run while `*.remote-conflict.*`
  files exist (error lists them). Conflict files are excluded from sync and from optimization.
- Deletions: local delete (file in base, missing locally, remote unchanged) → remote file moved to
  `<remote>/.assets-sync/trash/<YYYY-MM-DD>/<path>` + tombstone. Remote tombstone → local file deleted.
  Overwritten remote files also go to trash (`--backup-dir`). **No delete cap.**
- Trash dirs older than **30 days** are purged at the end of each successful sync.
- Changelog: `<remote>/.assets-sync/changelog.jsonl`, one JSON line per changed path:
  `{version, at, by, op: "add"|"update"|"delete", path, sha256?}` (rewritten via cat+rcat).
- File identity = sha256 computed locally (backend-agnostic). Remote size + modTime (from `lsjson`) are stored per
  entry to detect out-of-band edits made in the Drive/B2 web UI.
- `by` = `os.hostname()`.
- Hash cache: `<originalsDir>/.assets-sync/hash-cache.json` keyed by relative path → `{size, mtimeMs, sha256}`.
- `.assets-sync/` is excluded from: rclone listings/transfers of originals (`--exclude "/.assets-sync/**"`),
  local scans, and asset optimization walkers.
- CLI binary name stays `assets-optimizer` (already distinct from assets-service's `assets`).
- `processAssets()` API kept; `resync` option kept as **deprecated no-op** (consumers pass it). `bisync`,
  `shouldBisync` removed from source and exports.
- Optimized outputs: before optimizing, pull existing outputs from the dest remote
  (`rclone copy <dest> <optimizedDir> --update`), so hashed files are skipped and local ⊇ remote.
  After optimizing, keep `rclone sync` upload (safe now because local was completed from remote first).
  If pull or optimize throws, nothing is uploaded/deleted.
- Use existing deps only (valibot for schema, node:crypto for sha256, Bun.spawn via rclone helpers). No new deps.
- Code style: follow repo conventions (one main export per file, verb-first function names like existing code,
  throw errors like existing code, biome formatting: no semicolons, 2 spaces, 120 cols).

## Data model (`src/sync/SyncCatalog.ts`, valibot schema)

```ts
interface SyncCatalogFile { sha256: string; size: number; remoteModTime: string; rev: number; updatedAt: string; updatedBy: string }
interface SyncCatalogTombstone { sha256: string; rev: number; deletedAt: string; deletedBy: string }
interface SyncCatalog {
  schemaVersion: 1
  version: number            // global edit counter, 0 = empty/new
  updatedAt: string
  updatedBy: string
  files: Record<string, SyncCatalogFile>          // key = posix relative path
  tombstones: Record<string, SyncCatalogTombstone>
}
```

## Sync algorithm (`syncOriginals({ localDir, remotePath, cwd, logLevel, dryRun })`)

1. Refuse if local `*.remote-conflict.*` files exist.
2. Read remote catalog R (missing → empty v0). Read local base B (missing → null = fresh machine).
   Scan local files L (sha256 via hash cache). List remote files RL (`lsjson -R --files-only`, excluding `.assets-sync`).
3. External remote changes (made outside the tool): RL path not in R.files, or size/modTime differ from R entry
   → "remote-external" (hash unknown). R.files path missing from RL → treated as remote delete.
   For external paths that also exist locally, compare with `rclone check <local> <remote> --files-from` (common hash):
   equal → adopt local sha256, no transfer.
4. Plan per path (pure function `syncPlanCreate`, fully unit tested):
   - With base B: `localChanged = L.sha256 !== B.files[p]?.sha256` (presence-aware);
     `remoteChanged = R.files[p]/R.tombstones[p] rev !== B entry rev` or external.
     - neither → none
     - remote only → download / delete-local
     - local only → upload / delete-remote
     - both → none if final contents equal (same sha256 or both deleted), else **conflict**
   - Without base (fresh machine):
     L & R same → none (adopt); L & R differ → conflict; L only (no entry) → upload;
     L & tombstone with same sha256 → delete-local; L & tombstone with different sha256 → upload (re-add);
     R only → download.
5. `dryRun` (status) → print plan (↑ upload, ↓ download, ✕ delete-local, ✕ delete-remote, ⚠ conflict) and return it.
6. Conflicts present → download remote copies as `.remote-conflict` files, ack in base, write base, throw.
7. Execute: downloads (`rclone copy --files-from`), local deletes, uploads (`rclone copy --files-from
   --backup-dir <remote>/.assets-sync/trash/<date>`), remote deletes (move into trash; verify which rclone
   command works when trash is inside the remote root; fallback per-file `moveto`). Re-`lsjson` uploaded paths
   to record size/modTime.
8. Commit: re-read remote catalog; if its version !== R.version → retry the whole sync (max 3 attempts), else
   if anything changed in the catalog: write R' with `version = R.version + 1`, changed entries `rev = version`,
   append changelog lines. Write local base = R' (or R if nothing changed). Save hash cache.
9. Purge trash date-dirs older than 30 days.

## Tasks

1. [x] Worktree + baseline (worktree `/tmp/opencode/assets-optimizer-sync-THtO`, branch `feat/catalog-sync`).
2. [x] Fix the pre-existing failing test `test/allowRootImageFiles.test.ts:99` (expects `hero:`, output has `"hero":`) — fix the test assertion or generator, whichever matches current intended output format.
3. [x] `src/sync/` pure core: `SyncCatalog.ts` (types + valibot schema + `syncCatalogParse`), `syncCatalogEmpty`,
   `SyncPlan` types, `syncPlanCreate` (step 4 incl. external changes as input), `syncCatalogApply` (produce next
   catalog + changelog lines from executed plan). Unit tests in `test/syncPlanCreate.test.ts`, `test/syncCatalogApply.test.ts`.
4. [x] `src/sync/` IO adapters (done: `src/sync/syncRemote*.ts`, `syncLocal*.ts`, `syncConflictPath.ts`,
   `syncPathsWithFile.ts`, `src/rclone/runRcloneCapture.ts`; rclone rejects `--exclude` with `--files-from-raw`, so
   upload validates path lists instead; remote delete = one `rclone move --files-from-raw` into dated trash): `runRcloneCapture` (stdout capture, stdin input) in `src/rclone/`; remote catalog
   read/write; changelog append; remote listing; copy/upload with files-from + backup-dir; remote delete to trash;
   `rclone check` compare; trash purge (>30d); local scan with hash cache (ignore `.assets-sync`, conflict files,
   existing ignored dirs). Tests use local directories as the "remote" (rclone supports local paths).
5. [x] `syncOriginals` orchestration (`src/sync/syncOriginals.ts`, `SyncOriginalsOptions.ts`, `SyncOriginalsResult.ts`;
   returns `{ plan, summary, catalogVersion }`; dryRun writes nothing) (steps 1–9) + integration test with two "machines" (two local dirs) and one
   local "remote" dir: fresh machine pull, add/update/delete propagation, tombstone deletes stale local file,
   conflict creates `.remote-conflict` and stops, resolution next run, external remote add/edit/delete,
   version counter increments once per changing run, migration from existing remote without catalog.
6. [x] `processAssets` rewrite (+ video/font stale-output cleanup, since outputs are now pulled from R2): use `syncOriginals` instead of bisync; outputs pull-before-optimize; keep `resync`
   as deprecated no-op; remove `bisync.ts`, `shouldBisync.ts` + exports; export new sync API from `src/index.ts`;
   make optimization walkers ignore `.assets-sync` and `*.remote-conflict.*`.
7. [x] CLI (human-readable by default, `--json` for envelope): add `status` and `sync` commands to `assets-optimizer` (`--local <dir> --remote <path>`, `sync --dry-run`
   = status); README: replace bisync docs with catalog sync docs (layout, conflict resolution, trash, migration).
8. [ ] Final verification: `bun test`, `bun --check`, `bun run build`; read-only `status` against a real consumer.

## Verification

- Unit/integration: `bun test test/<file>.test.ts` for touched areas only during tasks; full `bun test` only in task 8.
- Typecheck: `bun --check`. Build: `bun run build`.
- No live-network/real-remote writes in tests; rclone with local paths only.
