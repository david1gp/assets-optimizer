# optimize-images-web

Process, hash, sync, and clean image assets for web projects that keep originals outside git and use R2 as the canonical store, with a separate pass for web videos.

This package is built for a workflow with two local directories:

- `images`: original source images, never modified
- `public/images`: generated optimized images, flat output only
- `videos`: original source videos, optional
- `public/videos`: processed videos, optional

It is designed for projects where:

- originals live in R2 and are synced locally
- optimized outputs should be deterministic and aggressively cacheable
- output filenames should change when either the source file or the transform changes
- old optimized files should be removed locally and remotely
- a separate image-list generator should preserve existing alt text for images

## What It Does

`optimizeAssets()` performs the full asset pipeline:

1. Resolves the project name from `package.json.name`
2. Uses that as the bucket base path on your `rclone` remote
3. Syncs originals between R2 and `images`
4. Scans transform folders like `1920x1080_jpg`
5. Processes matching image source files with `sharp`
6. Writes flat optimized images into `public/images`
7. Names image files as `<basename>_<hash>.<ext>`
8. Skips already-generated images
9. Deletes stale optimized images locally
10. Uploads missing optimized images to R2 with cache headers
11. Deletes stale optimized images from R2
12. Runs a separate optional video pass from `videos` to `public/videos`
13. Keeps video filenames unchanged and skips any processed video that already exists
14. Uploads missing processed videos to R2 without deleting manual variants
15. Prints a clear summary of what changed

The hash is derived from:

- source file bytes
- normalized transform spec

That means image cache keys change when the source image changes or when you change the folder rule, even if the output filename format stays short.

## Folder Convention

Original files belong in transform folders inside `images`.

Example:

```text
images/
  1920x1080_jpg/
    kitchen.jpg
    living-room.png
  1200x1200_webp/
    kitchen.jpg
```

This produces flat optimized image output like:

```text
public/images/
  kitchen_a1b2c3d4.jpg
  living-room_9f8e7d6c.jpg
  kitchen_7c6b5a4d.webp
```

Root-level files directly inside `images` are intentionally skipped and warned on every run.

Videos are handled separately and do not use transform folders:

```text
videos/
  hero.mp4
  intro.webm

public/videos/
  hero.mp4
  intro.webm
```

Video behavior:

- if both local `videos` and remote `video-originals` are missing, the video pass does nothing
- source videos sync through `video-originals`
- processed videos sync through `video-processed`
- missing processed videos are created with `ffmpeg`
- existing processed videos are skipped and preserved as manual transformations
- video filenames and relative paths are kept as-is
- stale processed videos are not deleted

## Transform Folder Format

Folder names must use:

```text
<width>x<height>_<format>
```

Supported image output formats:

- `jpg`
- `png`
- `webp`
- `avif`
Examples:

- `1920x1080_jpg`
- `1600x900_webp`
- `800x800_avif`
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

## Defaults

If you call `optimizeAssets()` with no arguments, it uses:

- `cwd`: `process.cwd()`
- `projectName`: `package.json.name`
- `imageOriginalsDir`: `./images`
- `imageOptimizedDir`: `./public/images`
- `videosDir`: `./videos`
- `processedVideosDir`: `./public/videos`
- `rcloneRemote`: `leo`
- `remoteImageOriginalsDir`: `image-originals`
- `remoteImageOptimizedDir`: `image-processed`
- `remoteVideoOriginalsDir`: `video-originals`
- `remoteVideoProcessedDir`: `video-processed`
- `cacheControlHeader`: `public,max-age=31536000,immutable`

So for a project named `moramontage`, the remote paths become:

- `leo:moramontage/image-originals`
- `leo:moramontage/image-processed`
- `leo:moramontage/video-originals`
- `leo:moramontage/video-processed`

## Installation

```bash
bun add @adaptive-ds/optimize-images-web
```

If you also generate a typed image list afterward, install that separately in the consuming app:

```bash
bun add -d @adaptive-ds/generate-image-list
```

## Basic Usage

Keep the package generic and let each app own its own `imageList` import path.

Example project entrypoint:

```ts
import path from "node:path"
import { imageList } from "@/app/images/imageList"
import { generateImageList } from "@adaptive-ds/generate-image-list"
import { optimizeAssets } from "@adaptive-ds/optimize-images-web"

const optimizedDir = path.resolve("public/images")
const outFile = path.resolve("src/app/images/imageList.ts")

await optimizeAssets()
await generateImageList(optimizedDir, outFile, imageList)
```

This preserves existing `alt` text because the previous `imageList` is passed back into `generateImageList`.

## API

```ts
import { optimizeAssets } from "@adaptive-ds/optimize-images-web"

const result = await optimizeAssets(options)
```

### `OptimizeImagesWebOptions`

```ts
interface OptimizeImagesWebOptions {
  cwd?: string
  projectName?: string
  imageOriginalsDir?: string
  imageOptimizedDir?: string
  videosDir?: string
  processedVideosDir?: string
  rcloneRemote?: string
  remoteImageOriginalsDir?: string
  remoteImageOptimizedDir?: string
  remoteVideoOriginalsDir?: string
  remoteVideoProcessedDir?: string
  cacheControlHeader?: string
}
```

### `OptimizeImagesWebResult`

```ts
interface OptimizeImagesWebResult {
  processed: string[]
  skippedExisting: string[]
  skippedRootFiles: string[]
  warnings: string[]
  deletedLocal: string[]
  uploadedRemote: string[]
  deletedRemote: string[]
  processedVideos: string[]
  skippedExistingVideos: string[]
  uploadedRemoteVideos: string[]
}
```

## Example With Custom Paths

```ts
import { optimizeAssets } from "@adaptive-ds/optimize-images-web"

await optimizeAssets({
  imageOriginalsDir: "./assets/originals",
  imageOptimizedDir: "./assets/optimized",
  rcloneRemote: "leo",
  remoteImageOriginalsDir: "image-originals",
  remoteImageOptimizedDir: "image-processed",
  cacheControlHeader: "public,max-age=31536000,immutable",
})
```

## Requirements

- `bun`
- `rclone`
- `ffmpeg`
- an existing `rclone` remote, defaulting to `leo`
- write access to the target bucket/path
- Node/Bun environment capable of running `sharp`

This package assumes the remote bucket/path already exists or can be created by `rclone mkdir`.

## Cleanup Behavior

The package does not use a manifest.

Instead it derives the expected output set from the current originals and current transform folders, then reconciles that against:

- local `public/images`
- remote `image-processed` objects

That means:

- files no longer produced by the current source set are deleted
- renaming or removing a source file cleans up stale optimized files
- changing a transform folder causes a different hash and a different output filename

## Recommended Workflow

1. Add or sync originals into `images/<transform-folder>/`
2. Run your local image pipeline entrypoint
3. Regenerate your typed image list
4. Reference the generated hashed filenames from app code or derived metadata

## Important Caveat

If your project currently stores source images directly at the root of `images`, this package will skip them by design.

Before adopting it fully, move originals into explicit transform folders such as:

```text
images/1920x1080_jpg/
```

That contract is what makes the output deterministic and safe to clean automatically.

## Publishing

This package is intended to be published from:

- npm package: `@adaptive-ds/optimize-images-web`
- repository: `david1gp/optimize-images-web`

## License

MIT
