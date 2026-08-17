# Assets microservice

## Goal

Build a separate Bun assets microservice that centralizes image, video, and font ingestion, backup, processing, metadata, versioning, publication, administration, and project catalog export. Consumer projects keep Git-tracked, type-safe asset lists but do not retain binary assets locally. Development and production serve public outputs from Cloudflare R2 custom domains. The existing local optimizer remains an explicit hash-based fallback.

## Decisions

### Service boundary and runtime

- Create a separate microservice module rather than embedding HTTP behavior into `assets-optimizer`.
- Run on one persistent server with Bun and local access to Sharp/libvips, ImageMagick, FFmpeg, rclone, and temporary disk.
- Run the HTTP/API/UI process separately from the worker process so media work cannot block authentication or administration requests.
- Keep the existing optimizer as the processing engine behind an adapter. Do not expose its local directory, rclone, or generated-file scanning conventions as the service API.
- Use bounded worker concurrency, with lower independent limits for image, video, font, rclone, and cleanup work.

### Source organization

- Organize service code as feature-first vertical slices rather than top-level technical layers.
- Give each feature only the technical subfolders it needs from `cli`, `api`, `api-client`, `schemas`, `actions`, `events`, and `url`; do not create empty placeholder folders.
- Reserve root `src/cli`, `src/api`, `src/api-client`, `src/schemas`, `src/actions`, `src/events`, and `src/url` for shared or generalized functionality used by multiple features.
- Keep feature-specific database repositories inside their owning feature, for example `src/asset/repository` and `src/workflow/repository`.
- Keep only generalized database infrastructure such as the SQLite connection, transaction helpers, Drizzle configuration, and migration execution under `src/infrastructure/db`.
- Keep R2, rclone, Telegram, Zitadel, filesystem, and external-process implementations under `src/infrastructure`; feature actions depend on explicit adapter interfaces rather than external SDKs directly.
- Keep executable composition roots under `src/entrypoints`. Entrypoints wire features and infrastructure but contain no domain behavior.
- Keep the SPA under `src/ui`; feature-specific API clients and schemas remain in their feature slices and are imported by the SPA.

### Storage and authority

- Use local SQLite with Drizzle ORM as the authoritative catalog and operational store.
- Enable SQLite WAL mode, use short transactions, and run all database users on the same host. Do not run multiple hosts against copied SQLite files.
- Persist jobs, leases, retries, upload state, projects, assets, source revisions, output definitions, public output versions, metadata, backup receipts, catalog generations, audit events, and Telegram delivery state.
- Store private originals/staging and public outputs in separate R2 buckets or strictly separate service-managed namespaces.
- Use separate development and production public R2 buckets/custom domains. Generated lists contain relative paths so domain selection remains application configuration.
- Store immutable canonical JSON manifests in private R2 for inspection and recovery. Do not use Markdown/frontmatter or R2 object metadata as the authoritative catalog.
- Limit R2 object custom metadata to identifiers, schema version, and checksums.
- Back up SQLite through SQLite's online backup mechanism and copy checksummed backups to private R2.

### Projects, environments, and credentials

- Scope every service resource by Zitadel organization, Zitadel project, service project, and environment.
- Bind each service project explicitly to its Zitadel organization/project and R2 development/production configuration.
- The remote CLI authenticates to the service and never receives Cloudflare or rclone secrets.
- The remote CLI preflight checks service-side R2 configuration, bucket access, and custom-domain availability.
- The local fallback requires and verifies `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` against the configured R2 endpoint and bucket; checking only variable presence is insufficient.
- Never accept Cloudflare credentials through command arguments, project manifests, API payloads, or generated lists.

### Authentication and roles

- Humans authenticate with Zitadel Authorization Code + PKCE and use an HttpOnly server session cookie in the SPA.
- Agents authenticate with Zitadel service accounts.
- Validate token signature through JWKS, issuer, audience, expiry, organization, exact project grant, and role on every API request.
- Use only two project-scoped roles:
  - `assets.uploader`: view project assets, upload assets, and view upload state.
  - `assets.admin`: all uploader capabilities plus project setup, bindings, metadata/output edits, processing, catalog generation, moves, and deletion.
- Provision setup agents with `assets.admin` for the exact project by default, not organization-wide or instance-wide administration.
- Public website delivery requires no Zitadel role.
- Reuse the existing Zitadel provisioning conventions, but add explicit per-user/service-account project grants because the existing setup primarily grants project access at organization level.

### SPA and human upload flow

- Build an authenticated SPA with SolidJS, TypeScript, Vite, Tailwind CSS v4, Valibot, and `@adaptive-ds/mdi`, following `~/leo/software` conventions.
- Use client-side routes so Telegram notifications can deep-link to projects, assets, and uploads.
- Serve the built SPA and API from the Bun server under one origin.
- Present project list, complete flat asset inventory, upload form, asset details, source/output history, metadata/output editor, job state, backup state, project settings, and complete-asset deletion.
- Upload browsers directly to a private R2 staging object through a short-lived, exact-key signed URL. Verify byte length, checksum, and detected media type before accepting the upload.
- Require zero to three logical folder fields and a required textarea labeled `Where should this asset be included?`.
- Store the textarea as `integrationNote` on the upload/asset record.
- Do not implement a review or approval workflow. A successfully accepted upload is processed and immediately included in the service catalog and subsequent generated lists.

### Telegram

- Send one `customer_asset_uploaded` Telegram notification for a successful uploader-role submission.
- Include organization/project, uploader, original filename, integration note, upload time, preview when available, and a stable admin-SPA link.
- Do not send Telegram notifications for internal job transitions or admin/developer uploads.
- Persist Telegram delivery through an outbox/job and deduplicate retries by upload event ID.
- Telegram failure never rolls back an accepted upload or publication.

### Logical folders and asset identity

- Give every asset an immutable internal ID independent of its human-facing path.
- Persist exactly three nullable folder columns: `folder_1`, `folder_2`, and `folder_3`, plus filename/basename fields.
- Require contiguous folders: `folder_2` requires `folder_1`; `folder_3` requires `folder_2`.
- Expose folders through APIs as an array with zero to three segments.
- Normalize segments to Unicode NFC; reject empty segments, `/`, `\\`, absolute paths, `.`, `..`, and control characters.
- Preserve case and compare logical paths case-sensitively.
- Enforce uniqueness within a service project and asset class using the exact folder tuple and basename.
- Permit the same basename in different folders.
- Derive source-facing paths such as `home/hero.jpg` and generated TypeScript identifiers such as `home_hero_1920x1080_webp`.
- A folder move changes the current public path while preserving the internal asset ID and output bytes/version. Copy current immutable public objects to the new path, update the catalog atomically, and leave old paths unreferenced. Do not create redirects or rewrite source code.

### Source revisions, outputs, and metadata

- Use the term `output` for a concrete target/generated media file. Do not introduce recipe/rendition terminology.
- An image has one authoritative source revision and one or more explicit output definitions.
- A video has one source revision and one byte-identical public output; do not transcode or optimize video bytes.
- Font processing preserves typed font metadata and explicit outputs supported by the existing optimizer.
- An initial image output definition contains an explicit key, width, height, and format. Supported formats are `jpg`, `png`, `webp`, and `avif`.
- Preserve the current image behavior exactly:
  - Apply EXIF orientation with Sharp `.rotate()` before resize.
  - Resize with `fit: "inside"` and `withoutEnlargement: true`.
  - Preserve aspect ratio; do not crop, pad, distort, or enlarge.
  - Treat requested width/height as maximum bounds, not an exact canvas.
  - Default omitted format to WebP and default encoder quality to 80.
  - Save actual produced dimensions as output metadata.
- Output definition order is irrelevant; output keys are unique per logical asset.
- Add, remove, and atomically replace output definitions through CLI, API, and admin SPA. An image must retain at least one output unless the complete asset is deleted.
- Persist common output metadata: MIME type, byte size, SHA-256, extension, final object key, and schema/toolchain version.
- Persist typed media metadata:
  - Images: width, height, format, color space, alpha, orientation handling, frame count, and animation state.
  - Videos: width, height, duration, frame rate, container, video/audio codecs, streams, and bitrate while preserving source bytes.
  - Fonts: family, style, weight, width, variable axes, glyph count, Unicode ranges, format, and available license fields.
- Support typed, fine-grained metadata mutations. For image `alt`: omitted means unchanged, a non-empty string sets/replaces it, `""` means intentionally decorative, and explicit unset stores null.
- Reject media-inapplicable or unknown metadata fields. Metadata-only changes update SQLite and generated lists without regenerating files or incrementing public output versions.
- Do not recover metadata from previously generated TypeScript files. Legacy sidecar text may seed metadata only during import.

### AI provenance and labels

- Persist canonical AI provenance as `generated`, `enhanced`, or null on the current source metadata.
- Accept legacy `_ai_generated` as `generated` and legacy `_ai_modified` as `enhanced`; also accept the new `_ai_enhanced` spelling.
- Preserve the current visible AI-label behavior, including configurable label options and Contentoren's existing height of 40.
- Support an explicit `showAiLabel` override so AI-provenance assets such as Contentoren's selected reference images can be processed without a visible label.
- AI provenance is inherited by image outputs and included in generated metadata.
- Any AI-label setting that changes output bytes creates a new remote output version and local output hash. A provenance-only edit that leaves bytes unchanged does not.

### Remote versions and local hashes

- Centrally published image and video outputs use readable immutable `_v{n}` filename suffixes.
- Allocate versions transactionally in SQLite per logical output key. Start at `v1`; never reuse or overwrite a version; failed reservations may leave gaps.
- Add a new image output under its own output key at `v1`. Increment an existing output only when its produced bytes change.
- Uploading or generating bytes identical to an existing version reuses that version.
- Keep full SHA-256 values in SQLite and manifests even though remote public filenames use versions.
- Example remote image: `images/home/hero_1920x1080_webp_v3.webp`.
- Example remote video: `videos/home/introduction_v2.mp4`.
- Local fallback outputs use an output-byte hash suffix, preserving current hash-based behavior and requiring no central allocator.
- Example local image: `images/home/hero_1920x1080_webp_7e99b0ab.webp`.
- Remote and local generated lists share schemas, keys, sorting, and metadata but intentionally contain different output paths. Byte-identical list files are not required across modes.
- Apply long-lived immutable caching to versioned and hash-named public files. Never overwrite bytes or content type at an existing public key.

### Legacy folder import

- Provide an importer for current asset trees, including `leo@leo-server:/home/leo/projects/contentoren`.
- Interpret recognized transform-directory segments as target output definitions, remove those segments from logical folders, and never persist or recreate them as intermediate directories.
- Preserve current accepted forms: width only, width/height separated by `x` or `_`, optional supported format, and optional `_ai_generated`/`_ai_modified`; omitted height means square and omitted format means WebP.
- Reject invalid/zero dimensions, unsupported formats, multiple transform segments in one source path, nested transform folders, or logical paths exceeding three folders after transform removal.
- Group import candidates by logical folders and basename after removing transform segments and extensions.
- If candidates for one logical asset have the same source checksum, merge distinct transform folders into explicit outputs and deduplicate identical output definitions.
- If candidates have the same logical basename/path but different source checksums, fail that logical asset with a structured conflict. Do not choose a winner, rename automatically, or infer that a duplicate/derived file is authoritative; the client must resolve it.
- Report all conflicts in one import result while allowing unrelated non-conflicting assets to be processed according to the command's atomicity setting.
- Import same-name `.md`/`.txt` sidecar content as initial normalized alt text using current precedence rules, without persisting transform folders.
- Convert Contentoren's project-specific no-AI-label reference behavior into explicit `showAiLabel: false` settings before processing.

### Backup and local cleanup

- Use the exact configured rclone remote `gdrive_beta`; `beta_gdrive` is not configured.
- Back up every successfully completed original upload regardless of whether the actor is an uploader, administrator, or service account.
- Write append-only original backups beneath `gdrive_beta:backups/{org-name}/assets/{project-name}` and continue with logical folders, immutable asset/source revision identifiers, and the original filename to avoid collisions.
- Use `rclone copy`/`copyto`, never `sync` or `bisync`, for backup publication.
- Record a backup receipt containing source revision, remote path, byte size, supported checksum/check result, completion time, and job identity.
- Require verified original backup before processing/publication becomes current.
- Use per-asset isolated temporary workspaces.
- After backup, processing, R2 upload, checksum/size verification, database publication, and catalog/list availability all succeed, remove every local binary: import original, downloaded source, transformed intermediate, generated temporary output, and job workspace.
- The local fallback also uploads its final hash-named outputs to R2 and removes all local binary assets after successful publication.
- Failed jobs may retain only retry-scoped temporary files; they are not project assets. Cleanup is a separately retryable idempotent job and cannot regenerate media, republish, or allocate another version.

### Jobs and workflows

- Use one generic persisted job table, one workflow table, and dependency records. Do not create separate queue tables per media class.
- Use typed, schema-versioned job kinds and handlers:
  - `verify_original`
  - `backup_original`
  - `plan_outputs`
  - `process_image_output`
  - `copy_video_output`
  - `process_font_output`
  - `publish_asset`
  - `notify_customer_upload`
  - `cleanup_local_files`
- Store domain data in asset/source/output records; job payloads reference domain IDs instead of duplicating media metadata or settings.
- Persist job state, availability, priority, attempts, retry limit, lease owner/expiry, heartbeat, idempotency key, payload schema version, and structured error.
- Claim jobs transactionally. Expired leases become retryable after restart. Every handler tolerates at-least-once execution.
- Process independent image/font outputs in parallel within configured resource limits. Publication requires every required output to be verified and ready.
- Publish the catalog pointer only after all immutable objects exist and validate. Partial outputs never become current.
- Notification failure does not invalidate publication. Cleanup failure does not invalidate publication.

### Catalogs and generated TypeScript lists

- The service owns the complete current catalog; the consumer repository owns generated Git files.
- The service never receives Git credentials and never commits consumer files.
- Every accepted and successfully processed asset appears immediately in catalog exports, whether or not application source references it.
- The remote CLI fetches a deterministic authenticated catalog; the local CLI builds the same semantic catalog from local processing.
- A shared renderer always generates `imageList.ts`, `videoList.ts`, and `fontList.ts`, including empty lists.
- Keep lists flat for initial compatibility. Generate one entry per output rather than nesting resolutions under one asset.
- Build TypeScript-safe property identifiers from logical folders, basename, and output key, replacing separators/hyphens with underscores and prefixing identifiers that begin with a digit.
- Example properties: `imageList.home_hero_1920x1080_webp` and `imageList.home_hero_662x372_webp`.
- Reject identifier collisions; never use first/last traversal winner behavior.
- Sort entries lexically by generated key and use fixed UTF-8/LF formatting.
- Exclude timestamps, job IDs, signed URLs, absolute domains, and R2 ETags.
- Include exact relative current output path and normalized typed metadata required by the application.
- Include schema, catalog digest, and renderer version in a stable generated header.
- Support `lists` generation and `lists --check`; `--check` returns nonzero when committed files differ from deterministic output.

### CLIs

- Ship two explicit executables with shared schemas, key generation, catalog rendering, and JSON response envelopes:
  - `assets`: remote service client and default.
  - `assets-local`: local processing fallback using hashes.
- Never silently switch from remote to local after an error.
- Support remote/local equivalents for process, import, list, show, outputs, metadata, move, delete, doctor, and list generation where meaningful.
- Minimum command surface:
  - `assets auth login`
  - `assets doctor --environment <development|production>`
  - `assets import <root>`
  - `assets upload <file> --path <folder/file>`
  - `assets list [--kind image|video|font] [--include outputs,metadata,history]`
  - `assets show <asset-key>`
  - `assets outputs list <asset-key>`
  - `assets outputs add <asset-key> --width N --height N --format F`
  - `assets outputs remove <asset-key> <output-key>`
  - `assets outputs set <asset-key> --file <json>`
  - `assets metadata set <asset-key> --alt <text>`
  - `assets metadata unset <asset-key> --alt`
  - `assets move <asset-key> --to <path>`
  - `assets delete <asset-key>`
  - `assets lists`
  - `assets lists --check`
- Preserve one structured JSON envelope on stdout under `--json`, structured error codes, and nonzero exits for failed commands.

### Local static reference analysis

- Keep reference analysis entirely local to the CLI. Do not upload or persist counts in the service and do not display them in the administrative SPA.
- Return a single deterministic JSON object mapping every generated asset key to a non-negative static reference occurrence count, including zero values.
- Count only statically resolved exact references in configured TypeScript, TSX, and HTML source files.
- Exclude generated list declarations themselves from counts; they are inventory, not usage.
- Resolve direct generated-list property access, literal bracket access, static destructuring/aliases, and exact configured public-path literals.
- Ignore unresolved dynamic accesses such as `imageList[key]`; do not distribute them across candidate assets.
- Sort output keys lexically.
- Reference counts are advisory only. The service deletion endpoint never requests, stores, or consults them; an authorized agent/human decides whether to delete.

### Moves and deletion

- Folder moves create new public paths and leave previous immutable paths unreferenced.
- Complete-asset deletion is the only initial deletion operation; do not implement individual historical-version deletion.
- Authorized `assets.admin` deletion does not consult local reference counts and does not implement review or retention policy.
- Complete deletion removes the logical asset, current and historical source revisions, all outputs/versions, pre-move public paths, private R2 objects/manifests, Google Drive original backups, backup receipts, catalog entries, and associated service metadata/audit linkage required for deletion accounting.
- Perform deletion as a persisted idempotent workflow so partial remote deletions can retry without restoring catalog visibility.

## Approach

- Define versioned contracts first: project configuration, asset/source/output schemas, typed metadata, catalog export, generated-list shape, job payloads, and structured errors.
- Separate pure domain logic from infrastructure adapters. Key derivation, legacy transform parsing, resize semantics, catalog canonicalization, list rendering, version decisions, and conflict detection remain pure/testable.
- Place SQLite transaction boundaries around project binding, upload acceptance, version reservation, job claims, publication pointer changes, moves, and deletion state changes.
- Treat R2, Google Drive/rclone, Telegram, and Git working trees as non-transactional external effects. Use deterministic keys, idempotency records, and retryable jobs around each effect.
- Write immutable remote objects before making SQLite/catalog pointers current. Crashes may leave unreferenced objects but must never leave current records pointing to absent objects.
- Use shared Valibot schemas across Bun server, worker, remote CLI, local CLI, and SPA API client.
- Keep project-specific compatibility in import configuration/adapters rather than hard-coding Contentoren behavior into generic processors.
- Verify each increment with focused Bun unit/integration tests; verify SPA behavior through a browser subagent; verify rclone/R2 behavior against isolated development destinations before production credentials are accepted.

## Tasks

1. **[pending] Create the standalone module skeleton.** Add Bun package/build/test configuration, feature-first vertical slices, shared root technical folders, infrastructure adapters, separate API and worker composition roots, remote/local CLI entry points, SPA workspace, environment validation, and service operation files.
2. **[pending] Define shared contracts.** Add Valibot schemas and canonical JSON types for projects/environments, folders, asset classes, source revisions, output definitions, typed media metadata, AI provenance/label options, catalogs, jobs, API envelopes, errors, and Telegram events.
3. **[pending] Extract/preserve optimizer behavior.** Add a filesystem-independent processing adapter around the current optimizer and lock Sharp rotation, inside/no-enlargement resize, formats, quality, AI labels, font behavior, video metadata probing, and byte-copy video behavior with fixtures.
4. **[pending] Implement SQLite/Drizzle storage.** Add migrations and repositories for organizations, projects, environments, roles/bindings, assets, source revisions, output definitions, output versions, blobs, metadata, uploads, workflows, jobs/dependencies, backup receipts, catalogs, manifests, audit events, Telegram outbox, and deletion state.
5. **[pending] Implement immutable key/version logic.** Add folder/key validation, TypeScript identifier generation, remote `_vN` allocation, local output hashing, unchanged-byte reuse, path-move key creation, collision rejection, and immutable cache metadata.
6. **[pending] Implement R2 adapters and preflight.** Add private staging/source and public output clients, signed upload intents, checksum/size verification, development/production bindings, custom-domain probes, immutable upload/copy/delete operations, and remote/local credential doctor behavior.
7. **[pending] Implement Zitadel provisioning and authorization.** Add project/app/role provisioning, project-scoped uploader/admin grants for humans and service accounts, OIDC/PKCE session flow, machine token flow, JWKS validation, route authorization, and explicit service-project binding.
8. **[pending] Implement durable workflows and worker leasing.** Add transactional job claims, leases/heartbeats, dependencies, retries/dead state, bounded worker pools, idempotent handlers, restart recovery, and structured status APIs.
9. **[pending] Implement upload ingestion.** Add direct-to-R2 upload intents/completion, byte/type verification, folder fields, integration note, immediate catalog asset creation, source revision creation, workflow enqueueing, and uploader/admin audit identity.
10. **[pending] Implement mandatory Google Drive backup.** Use server-side `gdrive_beta`, create the defined backup hierarchy, perform append-only rclone copy/check, record receipts, block publication until verified, and make backup/deletion retries idempotent without exposing credentials.
11. **[pending] Implement image/font/video handlers.** Process each explicit image/font output, copy video bytes unchanged, extract validated typed metadata, apply AI provenance/labels and overrides, write immutable R2 objects/manifests, and atomically publish only complete asset output sets.
12. **[pending] Implement output and metadata mutation APIs.** Add list/show/add/set/remove output operations, fine-grained typed metadata set/unset, output-affecting change detection/reprocessing, metadata-only catalog updates, and conflict-safe mutations.
13. **[pending] Implement moves and complete deletion.** Add zero-to-three-folder moves with new public paths and unreferenced old paths, full catalog updates, complete-asset deletion workflows across SQLite/R2/Google Drive, and idempotent partial-failure recovery.
14. **[pending] Implement legacy import.** Parse current transform folders and AI suffixes, drop transform segments, import logical folders/sidecars, merge same-checksum outputs, error on same-key/different-checksum candidates, support Contentoren no-label overrides, and produce complete structured conflict reports.
15. **[pending] Implement deterministic catalogs and flat list renderer.** Export canonical current catalogs, generate one flat property per output for all three asset classes, reject key collisions, emit stable metadata/headers, and implement atomic write plus `--check` behavior.
16. **[pending] Implement remote and local CLIs.** Add shared command grammar and JSON envelopes, remote authentication/API operations, local hash-based fallback processing/R2 publication, configuration doctors, output/metadata/move/delete commands, import, and list generation without implicit fallback.
17. **[pending] Implement local reference-count scanning.** Parse configured TS/TSX through the TypeScript compiler API and HTML through a non-regex parser, resolve only exact static references, exclude generated declarations, emit every key including zero, and keep all results local.
18. **[pending] Implement the SolidJS admin SPA.** Add routed authenticated shell, project/asset inventory, direct upload with three folder fields and integration note, output/metadata editors, histories/statuses, moves, complete deletion, responsive accessible states, and API/session integration following `~/leo/software` conventions.
19. **[pending] Implement Telegram upload notifications.** Add project chat configuration, uploader-only event creation, integration-note payload, preview/deep link, outbox deduplication/retry, and non-blocking failure presentation.
20. **[pending] Implement cleanup and recovery.** Remove all local binaries only after verified backup/publication/catalog success, add retryable cleanup jobs, reclaim expired work safely, reconcile unreferenced staging/public objects, and back up/restore SQLite using private R2 snapshots.
21. **[pending] Complete cross-boundary verification.** Test remote/local semantic parity, version/hash immutability, duplicate import conflicts, Contentoren import fixtures, job restart/idempotency behavior, mandatory backup ordering, R2 custom-domain delivery/cache headers, Zitadel role isolation, deterministic Git output, local-only reference counts, SPA upload/admin flows, and complete deletion.

## Paths

### Plan

- `docs/20260817_assets_microservice.md`

### Existing optimizer and consumer references

- `src/assetsOptimize.ts`
- `src/process/processAssets.ts`
- `src/image/parseTransformSpec.ts`
- `src/image/processImage.ts`
- `src/image/buildExpectedImages.ts`
- `src/image/createOutputHash.ts`
- `src/list/AssetListTypes.ts`
- `src/list/generateImageList.ts`
- `src/list/generateVideoList.ts`
- `src/list/generateFontList.ts`
- `/home/leo/projects/contentoren/images`
- `/home/leo/projects/contentoren/src/app/assets/assetsProcess.ts`
- `/home/leo/projects/contentoren/src/app/assets/assetsOptimize.ts`
- `/home/leo/projects/contentoren/src/app/assets/imageList.ts`
- `/home/david/leo/software`
- `/home/david/leo_internal/contentoren-server/zitadel`

### Proposed standalone module layout

```text
src/
├── asset/
│   ├── cli/
│   ├── api/
│   ├── api-client/
│   ├── schemas/
│   ├── actions/
│   ├── events/
│   ├── url/
│   └── repository/
├── upload/
├── output/
├── metadata/
├── catalog/
├── project/
├── import/
├── processing/
├── workflow/
├── backup/
├── notification/
├── authentication/
├── deletion/
├── reference-analysis/
│
├── cli/                    # Shared CLI parsing, context and output
├── api/                    # Shared server, middleware and envelopes
├── api-client/             # Shared HTTP transport and authentication
├── schemas/                # Shared primitives and error/envelope schemas
├── actions/                # Shared action execution infrastructure
├── events/                 # Shared event envelope, dispatcher and outbox
├── url/                    # Shared URL and path primitives
│
├── infrastructure/
│   ├── db/                 # Connection, transactions and migration runner only
│   ├── r2/
│   ├── rclone/
│   ├── telegram/
│   ├── zitadel/
│   ├── filesystem/
│   └── process/
│
├── entrypoints/
│   ├── api.ts
│   ├── worker.ts
│   ├── assets-cli.ts
│   └── assets-local-cli.ts
│
└── ui/
    ├── app/
    ├── components/
    └── routes/

drizzle/
ops/
tests/
├── fixtures/
│   └── contentoren/
├── integration/
└── e2e/
```

Every feature follows the same available shape, but includes only folders it uses:

```text
src/{feature}/
├── cli/                    # Commands owned by the feature
├── api/                    # HTTP routes owned by the feature
├── api-client/             # Typed client calls owned by the feature
├── schemas/                # Feature contracts and Valibot schemas
├── actions/                # Use cases and domain orchestration
├── events/                 # Events emitted or consumed by the feature
├── url/                    # Feature-specific key and URL construction
└── repository/             # Feature persistence interfaces/implementations
```

Initial feature ownership:

- `asset`: asset identity, logical folders, inventory, details, and moves.
- `upload`: upload intents, staging completion, verification, and source revisions.
- `output`: output definitions, versions, immutable keys, and publication state.
- `metadata`: typed media metadata, AI provenance, and AI-label settings.
- `catalog`: canonical exports, list rendering, digests, and catalog pointers.
- `project`: organizations, projects, environments, bindings, and configuration.
- `import`: legacy path parsing, candidate grouping, sidecars, and conflict reports.
- `processing`: optimizer adapter and image, video, and font handlers.
- `workflow`: workflows, jobs, dependencies, leases, retries, and cleanup scheduling.
- `backup`: original backup execution, receipts, SQLite snapshots, and restoration.
- `notification`: Telegram upload events, outbox delivery, and deduplication.
- `authentication`: Zitadel login, sessions, token validation, roles, and grants.
- `deletion`: complete-asset deletion orchestration and remote deletion progress.
- `reference-analysis`: local TS/TSX/HTML static reference counting.

Repository ownership examples:

- `src/asset/repository/AssetRepository.ts`
- `src/output/repository/OutputRepository.ts`
- `src/workflow/repository/JobRepository.ts`
- `src/project/repository/ProjectRepository.ts`
- `src/infrastructure/db/Database.ts`
- `src/infrastructure/db/transactionRun.ts`

Feature actions may use repositories from another feature only through that feature's public repository contract. Cross-feature behavior is coordinated by actions and typed events; it must not be moved into root shared folders merely because two features interact.
