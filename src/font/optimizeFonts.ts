import fs from "node:fs/promises"
import path from "node:path"
import ttf2woff2 from "ttf2woff2"
import { dirExists } from "../shared/dirExists.js"
import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import type { OptimizeFontsOptions } from "./OptimizeFontsOptions.js"
import { createLogger } from "../shared/logger.js"
import { printSummary } from "../shared/printSummary.js"
import { walkFiles } from "../shared/walkFiles.js"
import { supportedFontSourceExtensions } from "./supportedFontExtensions.js"
import { generateFontList } from "../list/generateFontList.js"
import { parseFontFilename } from "./parseFontFilename.js"

async function processFontFile(
  sourcePath: string,
  originalsDir: string,
  optimizedDir: string,
  result: AssetsOptimizeResult,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const extension = path.extname(sourcePath).toLowerCase()
  const relativePath = path.relative(originalsDir, sourcePath)
  const relativePathWithoutExt = relativePath.replace(/\.[^.]+$/, "")
  const outputPath = path.join(optimizedDir, relativePathWithoutExt + ".woff2")

  parseFontFilename(path.basename(sourcePath))

  try {
    await fs.access(outputPath)
    result.skippedExistingFonts.push(relativePath)
    return
  } catch {}

  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  if (supportedFontSourceExtensions.has(extension)) {
    const inputBuffer = await fs.readFile(sourcePath)
    const woff2Buffer = ttf2woff2(inputBuffer)
    await fs.writeFile(outputPath, woff2Buffer)
    result.processedFonts.push(relativePath)
  }
}

export async function optimizeFonts(options: OptimizeFontsOptions = {}): Promise<AssetsOptimizeResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const fontOriginalsDir = path.resolve(cwd, options.fontOriginalsDir ?? "fonts")
  const fontOptimizedDir = path.resolve(cwd, options.fontOptimizedDir ?? "public/fonts")
  const fontListOutputPath = path.resolve(cwd, options.fontListOutputPath ?? "src/app/assets/fontList.ts")
  const logger = createLogger(options.logLevel)

  const result: AssetsOptimizeResult = {
    processed: [],
    skippedExisting: [],
    skippedRootFiles: [],
    warnings: [],
    deletedLocal: [],
    processedFonts: [],
    skippedExistingFonts: [],
    processedVideos: [],
    skippedExistingVideos: [],
    processedVideoPreviews: [],
    skippedExistingVideoPreviews: [],
  }

  if (await dirExists(fontOriginalsDir)) {
    for (const sourceFile of await walkFiles(fontOriginalsDir)) {
      const extension = path.extname(sourceFile).toLowerCase()

      if (!supportedFontSourceExtensions.has(extension)) {
        result.warnings.push(`Skipped unsupported font source file: ${sourceFile}`)
        continue
      }

      await processFontFile(sourceFile, fontOriginalsDir, fontOptimizedDir, result, logger)
    }
  }

  if (options.generateFontList !== false) {
    await generateFontList(fontOptimizedDir, fontListOutputPath, undefined, logger)
  }

  printSummary(result, logger)
  return result
}