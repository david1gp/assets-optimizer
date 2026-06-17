# @adaptive-ds/assets-optimizer

Process, hash, sync, and clean image assets for web projects that keep originals outside git and optionally sync through any `rclone` remote, with a separate pass for web videos.

Features

- originals may live on an `rclone` remote and be synced locally
- optimized outputs should be deterministic and aggressively cacheable
- output filenames should change when either the source file or the transform changes
- old optimized files should be removed locally and remotely
- generates type-safe `imageList.ts` and `videoList.ts` should stay in sync with processed assets

Quick link

- code - https://github.com/david1gp/assets-optimizer
- npm - https://www.npmjs.com/package/@adaptive-ds/assets-optimizer


## Diagrams

### Overview

![Overview](docs/arch/overview_v1.excalidraw.svg)

### Images

![Image process](docs/arch/process_image_v1.excalidraw.svg)

### Videos

![Video process](docs/arch/process_video_v1.excalidraw.svg)

## What It Does

`processAssets()` orchestrates the full workflow:

1. Syncs originals from remote source to local `images` and `videos` folders via `rclone bisync`
2. Runs `assetsOptimize()` to process images and videos locally
3. Uploads optimized assets to s3-compatible remote destination with caching headers

`assetsOptimize()` performs the core asset processing:

1. Resolves the project name from `package.json.name`
2. If `rcloneRemote` is configured, uses that project name as the base path on the remote
3. If `rcloneRemote` is configured, syncs originals between the remote and `images`
4. Scans transform folders like `1920x1080_jpg`, optionally nested in grouping folders
5. Processes matching image source files with `sharp`
6. Writes flat optimized images into `public/images`
7. Names image files as `<basename>_<hash>.<ext>`
8. Skips already-generated images
9. Deletes stale optimized images locally
10. If `rcloneRemote` is configured, uploads missing optimized images to the remote with cache headers
11. If `rcloneRemote` is configured, deletes stale optimized images from the remote
12. Runs a separate optional video pass from `videos` to `public/videos`
13. Generates a hashed `<basename>_<hash>.webp` preview beside each processed video (full resolution, `sharp`-encoded)
14. Keeps video filenames unchanged and skips any processed video or preview that already exists
15. If `rcloneRemote` is configured, uploads videos with a short cache header and their hashed previews with a long (immutable) cache header
16. Generates `src/app/assets/imageList.ts` and `src/app/assets/videoList.ts` by default
17. Prints a clear summary of what changed

The hash is derived from:

- source file bytes
- normalized transform spec

That means image cache keys change when the source image changes or when you change the folder rule, even if the output filename format stays short.

## Folder Convention

Original files belong under one transform folder inside `images`. Arbitrary grouping folders may appear before and after the transform folder.

Example:

```text
images/
  interiors/
    homes/
      1920x1080_jpg/
        hero/
          living-room.png
  products/
    1200x1200_webp/
      kitchen.jpg
```

This produces flat optimized image output like:

```text
public/images/
  living-room_9f8e7d6c.jpg
  kitchen_7c6b5a4d.webp
```

Files that are not inside a transform folder are ignored. Folders whose name contains `ignore` are skipped entirely.

Only the first transform folder in a path is used. If another transform-looking folder appears below it, that nested folder is skipped with a warning.

Videos are handled separately and do not use transform folders:

```text
videos/
  hero.mp4
  intro.webm

public/videos/
  hero.mp4
  hero_a1b2c3d4.webp
  intro.webm
  intro_9f8e7d6c.webp
```

Video behavior:

- if both local `videos` and remote `video-originals` are missing, the video pass does nothing
- if `rcloneRemote` is configured, source videos sync through `video-originals`
- if `rcloneRemote` is configured, processed videos sync through `video-processed`
- missing processed videos are created with `ffmpeg`
- missing preview images are created beside processed videos as `<basename>_<hash>.webp`:
  `ffmpeg` extracts a representative frame at full resolution, then `sharp` re-encodes it to
  webp at `videoPreviewQuality` (default `65`, the same encoder/quality scale used for images)
- the preview hash is derived from the processed video's content, so the preview filename busts
  when the video changes; previews can therefore be cached immutably even though video filenames
  are not hashed
- existing processed videos are skipped and preserved as manual transformations
- existing previews are skipped; stale previews from a previous hash are removed when regenerated
- video filenames and relative paths are kept as-is (optimize them by hand)
- stale processed videos are not deleted

## Hash Length

Output filenames are `<basename>_<hash>.<ext>`, where the hash defaults to 8 hex chars.
Set `imageHashLength` to use a shorter (or longer) suffix:

```ts
await assetsOptimize({
  imageHashLength: 3,
})
```

```text
images/1920x1080_webp/ship_PYM.webp  ->  public/images/ship_PYM_a1b.webp
```

The hash only busts cache when a single file's content changes — the basename already
distinguishes different images, so cross-file collisions never matter. The only risk of a
short hash is that an edited file re-hashes to the same suffix and its cache is not busted:
roughly `1 / 16^length` per edit (≈ 1/4096 at length 3). The generated `imageList.ts`
strips exactly `imageHashLength` hex chars to keep stable keys, so keep this value in sync
with the existing list.

`imageTypeImportPath` sets the `import type { ImageType } from "..."` line of the
generated `imageList.ts` (defaults to this package's name).

## Transform Folder Format

Folder names must use:

```text
<width>x<height>_<format>
```

Supported image output formats:

- `jpg`
- `png`
- `webp`
Examples:

- `1920x1080_jpg`
- `1600x900_webp`
Image processing behavior:

- resize fit: `inside` / max-bounds scaling
- `withoutEnlargement: true`
- image auto-rotation is applied
- default quality is `80`

Supported video source extensions:

- `mp4`
- `mov`
- `m4v`
- `webm`
- `avi`
- `mkv`

## Installation

```bash
bun add -D @adaptive-ds/assets-optimizer
```

## Basic Usage

Example project entrypoint:

```ts
import { assetsProcess } from "@adaptive-ds/assets-optimizer"

await assetsProcess()
```

This generates optimized images, processed videos, hashed webp video previews, `imageList.ts`, and `videoList.ts` in one run. 

Existing image alt text and existing video preview alt text are preserved when the generated files already exist.

## Local folders

This package is built for a workflow with two local directories:

- `images`: original source images, never modified
- `public/images`: generated optimized images, flat output only
- `videos`: original source videos, optional
- `public/videos`: processed videos, optional

## Optimization

### Images

- Source images live below transform folders like `1920x1080_jpg` inside `images/`
- Grouping folders may appear before and after the transform folder
- Each source file is resized to fit within the specified bounds without enlargement
- Auto-rotation is applied based on EXIF data
- Output quality defaults to 80%
- Files are named using a hash of the source content and transform spec
- Existing optimized files are skipped unless their source changed
- Stale optimized files (from deleted sources or changed transforms) are removed
- A TypeScript list file is generated with all processed image references

### Videos

- Source videos live directly in `videos/` (no transform folders)
- Each video is copied to the output directory using `ffmpeg`
- A hashed, full-resolution webp preview (`sharp`-encoded at `videoPreviewQuality`, default `65`) is generated beside each processed video
- Video filenames stay unhashed (optimize length/etc. by hand); previews are content-hashed so they cache-bust on change
- Existing processed videos and previews are preserved as-is
- A TypeScript list file is generated with all processed video references

## Requirements

- `bun`
- `rclone`
- `ffmpeg`
- an existing `rclone` remote
- write access to the target bucket/path
- Node/Bun environment capable of running `sharp`

This package assumes the remote bucket/path already exists or can be created by `rclone mkdir`.

## Cleanup Behavior

The package does not use a manifest.

Instead it derives the expected output set from the current originals and current transform folders, then reconciles that against:

- local `public/images`
- remote `images/optimized` objects

That means:

- files no longer produced by the current source set are deleted
- renaming or removing a source file cleans up stale optimized files
- changing a transform folder causes a different hash and a different output filename

## Recommended Workflow

1. Add or sync originals into `images/<grouping-folders>/<transform-folder>/<grouping-folders>/`
2. Run your local image pipeline entrypoint
3. Regenerate your typed image list
4. Reference the generated hashed filenames from app code or derived metadata

## Important Caveat

If your project currently stores source images directly at the root of `images`, this package will skip them by design.

Before adopting it fully, move originals below explicit transform folders such as:

```text
images/1920x1080_jpg/
```

That contract is what makes the output deterministic and safe to clean automatically.

## License

MIT
