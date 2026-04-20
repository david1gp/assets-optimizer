import type { FontType } from "../list/AssetListTypes.js"

export interface ProcessFontsOptions {
  cwd?: string
  logLevel?: 0 | 1 | 2 | 3
  sourceFontsRemotePath: string
  destFontsRemotePath: string
  fontOriginalsDir?: string
  fontOptimizedDir?: string
  fontListOutputPath?: string
  fontCacheControl?: string
  resync?: boolean
  processFonts?: boolean
}