import { posix } from "node:path"

export function syncConflictPath(path: string): string {
  const ext = posix.extname(path)
  return `${ext ? path.slice(0, -ext.length) : path}.remote-conflict${ext}`
}
