import { createHash } from "node:crypto"
import { copyFile, mkdir, readFile, rename, rm, stat } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { imageSize } from "image-size"
import sharp from "sharp"
import type { SyncResolveKeep, SyncResolveOptions } from "./SyncResolveOptions.js"
import type { SyncResolveConflict, SyncResolveResult } from "./SyncResolveResult.js"
import { syncConflictOriginal } from "./syncConflictOriginal.js"
import { syncLocalCatalogRead } from "./syncLocalCatalogRead.js"
import { syncLocalConflictList } from "./syncLocalConflictList.js"

const marker = ".remote-conflict"
const pixelCompareMaxBytes = 50 * 1024 * 1024

export async function syncResolve(options: SyncResolveOptions): Promise<SyncResolveResult> {
  const keep = options.keep
  if (keep !== undefined && keep !== "local" && keep !== "remote" && keep !== "both") {
    throw new Error('keep must be "local", "remote" or "both"')
  }
  const localDir = resolve(options.cwd ?? process.cwd(), options.localDir)
  const dirInfo = await stat(localDir).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  })
  if (!dirInfo?.isDirectory()) throw new Error(`Local directory does not exist: ${localDir}`)
  const copies = await syncLocalConflictList(localDir)
  const base = await syncLocalCatalogRead(localDir)
  const outstanding: { path: string; copyPath: string; orphan: boolean }[] = copies.map((copyPath) => {
    const original = syncConflictOriginal(copyPath)
    return original ? { path: original, copyPath, orphan: false } : { path: copyPath, copyPath, orphan: true }
  })

  const selected: { path: string; copyPath: string; orphan: boolean }[] = []
  const unknown: string[] = []
  if (options.paths?.length) {
    for (const requested of options.paths) {
      const normalized = requested.replace(/^\.\//, "")
      const match = outstanding.find(
        (entry) =>
          entry.path === requested ||
          entry.copyPath === requested ||
          entry.path === normalized ||
          entry.copyPath === normalized,
      )
      if (match) selected.push(match)
      else if (!unknown.includes(requested)) unknown.push(requested)
    }
  } else {
    selected.push(...outstanding)
  }

  const conflicts: SyncResolveConflict[] = []
  for (const entry of [...selected].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    conflicts.push(await resolveOne(localDir, base, entry, keep))
  }
  for (const path of [...unknown].sort()) {
    conflicts.push({
      path,
      copyPath: "",
      orphan: false,
      local: { exists: false },
      remote: { exists: false },
      action: "error",
      error: `"${path}" is not an outstanding conflict in ${localDir}`,
    })
  }
  conflicts.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

  const failed = conflicts.filter((conflict) => conflict.action === "error").length
  const resolved = conflicts.filter((conflict) => conflict.action !== "listed" && conflict.action !== "error").length
  return {
    conflicts,
    summary: { total: conflicts.length, resolved, failed, listed: conflicts.length - resolved - failed },
  }
}

async function resolveOne(
  localDir: string,
  base: Awaited<ReturnType<typeof syncLocalCatalogRead>>,
  entry: { path: string; copyPath: string; orphan: boolean },
  keep: SyncResolveKeep | undefined,
): Promise<SyncResolveConflict> {
  const localFull = join(localDir, entry.path)
  const copyFull = join(localDir, entry.copyPath)
  let local: SyncResolveConflict["local"]
  let remote: SyncResolveConflict["remote"]
  let localBuffer: Buffer | null = null
  let copyBuffer: Buffer | null = null
  try {
    const info = await stat(localFull).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
      throw error
    })
    if (!info?.isFile()) {
      local = { exists: false }
    } else {
      localBuffer = await readFile(localFull)
      local = {
        exists: true,
        size: info.size,
        mtime: info.mtime.toISOString(),
        sha256: createHash("sha256").update(localBuffer).digest("hex").slice(0, 12),
        ...imageReport(localBuffer),
      }
    }
    const copyInfo = await stat(copyFull).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
      throw error
    })
    if (!copyInfo?.isFile()) {
      remote = { exists: false }
    } else {
      copyBuffer = await readFile(copyFull)
      const catalogFile = base?.files[entry.path]
      remote = {
        exists: true,
        size: copyInfo.size,
        mtime: copyInfo.mtime.toISOString(),
        sha256: createHash("sha256").update(copyBuffer).digest("hex").slice(0, 12),
        ...imageReport(copyBuffer),
        ...(catalogFile ? { updatedAt: catalogFile.updatedAt, updatedBy: catalogFile.updatedBy } : {}),
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ...entry, local: { exists: false }, remote: { exists: false }, action: "error", error: message }
  }

  const pixels = await comparePixels(localBuffer, copyBuffer)
  const conflict: Omit<SyncResolveConflict, "action"> = { ...entry, local, remote, ...(pixels ? { pixels } : {}) }

  if (entry.orphan) {
    conflict.note = "Orphan copy with no mappable original path"
  }
  if (keep === undefined) {
    return { ...conflict, action: "listed" }
  }
  try {
    if (keep === "local") {
      if (!local.exists) {
        return {
          ...conflict,
          action: "error",
          error: `Cannot keep local for "${entry.path}": no local file exists; use --keep remote or --keep both`,
        }
      }
      await rm(copyFull, { force: true })
      return { ...conflict, action: "kept-local", note: "Deleted the copy; the next sync uploads the local file" }
    }
    if (keep === "remote") {
      if (entry.orphan || !remote.exists) {
        return {
          ...conflict,
          action: "error",
          error: `Cannot keep remote for "${entry.path}": no copy contents to restore`,
        }
      }
      if (local.exists) {
        await mkdir(dirname(localFull), { recursive: true })
        await copyFile(copyFull, localFull)
        await rm(copyFull, { force: true })
      } else {
        await mkdir(dirname(localFull), { recursive: true })
        await rename(copyFull, localFull)
      }
      return {
        ...conflict,
        action: "kept-remote",
        note: "Replaced the local file with the copy; the next sync is a no-op",
      }
    }
    const targetPath = entry.copyPath.replace(marker, ".remote-copy")
    if (await fileExists(join(localDir, targetPath))) {
      return {
        ...conflict,
        action: "error",
        error: `"${targetPath}" already exists; leaving "${entry.copyPath}" untouched`,
      }
    }
    await mkdir(dirname(join(localDir, targetPath)), { recursive: true })
    await rename(copyFull, join(localDir, targetPath))
    return {
      ...conflict,
      action: "kept-both",
      targetPath,
      note: `"${targetPath}" is a normal original now: it syncs and gets optimized`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ...conflict, action: "error", error: message }
  }
}

function imageReport(buffer: Buffer): { width?: number; height?: number; format?: string } {
  try {
    const dimensions = imageSize(buffer)
    if (!dimensions.width || !dimensions.height) return {}
    return {
      width: dimensions.width,
      height: dimensions.height,
      ...(dimensions.type ? { format: dimensions.type } : {}),
    }
  } catch {
    return {}
  }
}

async function comparePixels(
  localBuffer: Buffer | null,
  copyBuffer: Buffer | null,
): Promise<"identical" | "differ" | null> {
  if (!localBuffer || !copyBuffer) return null
  if (localBuffer.length > pixelCompareMaxBytes || copyBuffer.length > pixelCompareMaxBytes) return null
  try {
    const [local, copy] = await Promise.all([
      sharp(localBuffer, { animated: false }).raw().toBuffer({ resolveWithObject: true }),
      sharp(copyBuffer, { animated: false }).raw().toBuffer({ resolveWithObject: true }),
    ])
    if (
      local.info.width !== copy.info.width ||
      local.info.height !== copy.info.height ||
      local.info.channels !== copy.info.channels
    ) {
      return "differ"
    }
    return local.data.equals(copy.data) ? "identical" : "differ"
  } catch {
    return null
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}
