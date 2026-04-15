import path from "node:path"

export function getAssetKey(filePath: string): string {
  const extension = path.extname(filePath)
  const fileName = path.basename(filePath, extension)
  let key = fileName.replace(/-/g, "_")

  if (/^\d/.test(key)) {
    key = `i${key}`
  }

  return key
}
