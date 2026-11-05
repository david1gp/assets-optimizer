import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export async function syncPathsWithFile<T>(paths: readonly string[], action: (file: string) => Promise<T>): Promise<T> {
  if (
    paths.some(
      (path) =>
        /[\r\n\\]/.test(path) ||
        path.split("/").some((part) => !part || part === "." || part === "..") ||
        path.split("/")[0] === ".assets-sync",
    )
  )
    throw new Error("Invalid sync path")
  const dir = await mkdtemp(join(tmpdir(), "assets-sync-"))
  try {
    const file = join(dir, "paths")
    await writeFile(file, `${paths.join("\n")}\n`)
    return await action(file)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
