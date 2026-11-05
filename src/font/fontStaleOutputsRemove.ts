import fs from "node:fs/promises"
import path from "node:path"
import { dirExists } from "../shared/dirExists.js"
import type { Logger } from "../shared/logger.js"
import { walkFiles } from "../shared/walkFiles.js"
import { supportedFontOutputExtensions, supportedFontSourceExtensions } from "./supportedFontExtensions.js"

export async function fontStaleOutputsRemove(
  originalsDir: string,
  optimizedDir: string,
  logger: Logger,
): Promise<void> {
  if (!(await dirExists(originalsDir))) {
    logger.warn(`Font originals directory missing; skipping stale output cleanup: ${originalsDir}`)
    return
  }
  if (!(await dirExists(optimizedDir))) return

  const expected = new Set<string>()
  for (const file of await walkFiles(originalsDir)) {
    const relative = path.relative(originalsDir, file)
    const ext = path.extname(relative)
    if (supportedFontSourceExtensions.has(ext.toLowerCase()) || supportedFontOutputExtensions.has(ext.toLowerCase())) {
      expected.add(`${relative.slice(0, -ext.length)}.woff2`)
    }
  }
  for (const file of await walkFiles(optimizedDir)) {
    const relative = path.relative(optimizedDir, file)
    if (path.extname(relative) !== ".woff2" || expected.has(relative)) continue
    await fs.rm(file)
    logger.files(`Deleted stale font output: ${relative}`)
  }
}
