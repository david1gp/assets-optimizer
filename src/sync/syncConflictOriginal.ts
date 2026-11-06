import { posix } from "node:path"

const marker = ".remote-conflict"

export function syncConflictOriginal(copyPath: string): string | null {
  const slash = copyPath.lastIndexOf("/")
  const dir = slash === -1 ? "" : copyPath.slice(0, slash)
  const name = slash === -1 ? copyPath : copyPath.slice(slash + 1)
  const index = name.indexOf(marker)
  if (index === -1) return null
  const original = `${name.slice(0, index)}${name.slice(index + marker.length)}`
  if (!original || original.startsWith(".")) return null
  return dir ? posix.join(dir, original) : original
}
