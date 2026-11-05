import fs from "node:fs/promises"
import path from "node:path"
import { dirExists } from "../shared/dirExists.js"
import type { Logger } from "../shared/logger.js"
import { walkFiles } from "../shared/walkFiles.js"
import { supportedVideoSourceExtensions } from "./supportedVideoSourceExtensions.js"

export async function videoStaleOutputsRemove(
  originalsDir: string,
  optimizedDir: string,
  logger: Logger,
): Promise<void> {
  if (!(await dirExists(originalsDir))) {
    logger.warn(`Video originals directory missing; skipping stale output cleanup: ${originalsDir}`)
    return
  }
  if (!(await dirExists(optimizedDir))) return

  const originals = new Set<string>()
  const previewBases = new Set<string>()
  for (const file of await walkFiles(originalsDir)) {
    const relative = path.relative(originalsDir, file)
    const ext = path.extname(relative)
    if (!supportedVideoSourceExtensions.has(ext.toLowerCase())) continue
    originals.add(relative)
    previewBases.add(relative.slice(0, -ext.length))
  }
  for (const file of await walkFiles(optimizedDir)) {
    const relative = path.relative(optimizedDir, file)
    const ext = path.extname(relative).toLowerCase()
    let stale = supportedVideoSourceExtensions.has(ext) && !originals.has(relative)
    if (ext === ".webp") {
      const match = /^(.*)_[0-9a-f]+\.webp$/.exec(relative)
      stale = match?.[1] !== undefined && !previewBases.has(match[1])
    }
    if (!stale) continue
    await fs.rm(file)
    logger.files(`Deleted stale video output: ${relative}`)
  }
}
