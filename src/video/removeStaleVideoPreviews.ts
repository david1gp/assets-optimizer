import fs from "node:fs/promises"
import path from "node:path"

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Remove previously generated previews for a video whose content hash has
 * changed (and any legacy unhashed `.jpg` preview), so stale previews are not
 * left behind to be uploaded. Only auto-generated `<basename>_<hash>.webp`
 * files are touched; the freshly generated preview is preserved.
 */
export async function removeStaleVideoPreviews(videoPath: string, keepPreviewPath: string): Promise<void> {
  const dir = path.dirname(videoPath)
  const basename = path.basename(videoPath, path.extname(videoPath))
  const keep = path.basename(keepPreviewPath)
  const hashedPreview = new RegExp(`^${escapeRegExp(basename)}_[0-9a-f]+\\.webp$`)
  const legacyPreview = `${basename}.jpg`

  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry === keep) {
      continue
    }
    if (hashedPreview.test(entry) || entry === legacyPreview) {
      await fs.rm(path.join(dir, entry), { force: true })
    }
  }
}
