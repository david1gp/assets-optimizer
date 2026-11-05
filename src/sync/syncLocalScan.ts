import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { join, posix } from "node:path"
import { isConflictFile } from "../shared/isConflictFile.js"
import { isIgnoredDir } from "../shared/isIgnoredDir.js"
import type { SyncLocalFile, SyncLocalFiles } from "./SyncPlan.js"

export async function syncLocalScan(
  localDir: string,
  ignoredDirs: readonly string[] = [],
  options: { writeCache?: boolean } = {},
): Promise<SyncLocalFiles> {
  const cacheDir = join(localDir, ".assets-sync")
  const cachePath = join(cacheDir, "hash-cache.json")
  let cache: Record<string, SyncLocalFile> = {}
  try {
    cache = JSON.parse(await readFile(cachePath, "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error
  }
  const files: Record<string, SyncLocalFile> = Object.create(null)
  async function walk(relative: string): Promise<void> {
    const entries = await readdir(join(localDir, relative), { withFileTypes: true }).catch((error) => {
      if (relative === "" && (error as NodeJS.ErrnoException).code === "ENOENT") return []
      throw error
    })
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue
      const path = posix.join(relative, entry.name)
      if (entry.isDirectory()) {
        if (!isIgnoredDir(entry.name, ignoredDirs) && !ignoredDirs.includes(path)) await walk(path)
        continue
      }
      if (!entry.isFile() || isConflictFile(entry.name)) continue
      const full = join(localDir, path)
      const info = await stat(full)
      const cached = cache?.[path]
      let sha256 = cached?.sha256
      if (
        cached?.size !== info.size ||
        cached?.mtimeMs !== info.mtimeMs ||
        cached?.ctimeMs !== info.ctimeMs ||
        cached?.ino !== info.ino ||
        cached?.dev !== info.dev ||
        !/^[a-f0-9]{64}$/.test(sha256 ?? "")
      ) {
        const hash = createHash("sha256")
        for await (const chunk of createReadStream(full)) hash.update(chunk)
        sha256 = hash.digest("hex")
      }
      files[path] = {
        sha256: sha256 as string,
        size: info.size,
        mtimeMs: info.mtimeMs,
        ctimeMs: info.ctimeMs,
        ino: info.ino,
        dev: info.dev,
      }
    }
  }
  await walk("")
  if (options.writeCache === false) return files
  await mkdir(cacheDir, { recursive: true })
  const temp = join(cacheDir, `hash-cache.${crypto.randomUUID()}.tmp`)
  try {
    await writeFile(temp, `${JSON.stringify(files, null, 2)}\n`)
    await rename(temp, cachePath)
  } finally {
    await rm(temp, { force: true })
  }
  return files
}
