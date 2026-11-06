import { afterEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import sharp from "sharp"
import type { SyncOriginalsOptions } from "../src/sync/SyncOriginalsOptions.js"
import { syncLocalCatalogRead } from "../src/sync/syncLocalCatalogRead.js"
import { syncOriginals } from "../src/sync/syncOriginals.js"
import { syncResolve } from "../src/sync/syncResolve.js"

const cli = resolve(import.meta.dir, "../src/cli/assetsOptimizerCli.ts")
const roots: string[] = []
const now = () => new Date("2026-11-05T12:00:00.000Z")
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function fixture() {
  const root = await mkdtemp("/tmp/opencode-sync-resolve-")
  roots.push(root)
  const remote = join(root, "remote")
  const local = join(root, "local")
  await mkdir(remote, { recursive: true })
  const sync = (options: Partial<SyncOriginalsOptions> = {}) =>
    syncOriginals({ localDir: local, remotePath: remote, logLevel: 0, now, by: "test", ...options })
  return { root, remote, local, sync }
}

async function put(dir: string, path: string, text: string): Promise<void> {
  await mkdir(join(dir, ...path.split("/").slice(0, -1)), { recursive: true })
  await writeFile(join(dir, path), text)
}

const text = (dir: string, path: string) => readFile(join(dir, path), "utf8")
const exists = (dir: string, path: string) => Bun.file(join(dir, path)).exists()

async function conflictedText() {
  const f = await fixture()
  await put(f.remote, "conflict.txt", "remote choice")
  await f.sync()
  await put(f.local, "conflict.txt", "local differs")
  await put(f.remote, "conflict.txt", "remote choice v2")
  const conflict = await f.sync()
  expect(conflict.summary.conflicts).toBe(1)
  expect(await text(f.local, "conflict.remote-conflict.txt")).toBe("remote choice v2")
  return f
}

async function run(...args: string[]) {
  const child = Bun.spawn([process.execPath, cli, ...args], { stdout: "pipe", stderr: "pipe" })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { code, stdout, stderr }
}

test("list-only changes nothing and reports both sides with catalog metadata", async () => {
  const f = await conflictedText()
  const before = await text(f.local, "conflict.txt")
  const result = await syncResolve({ localDir: f.local })
  expect(result.summary).toMatchObject({ total: 1, listed: 1, resolved: 0, failed: 0 })
  const [conflict] = result.conflicts
  expect(conflict?.path).toBe("conflict.txt")
  expect(conflict?.copyPath).toBe("conflict.remote-conflict.txt")
  expect(conflict?.action).toBe("listed")
  expect(conflict?.orphan).toBe(false)
  expect(conflict?.local.exists).toBe(true)
  expect(conflict?.local.size).toBe(before.length)
  expect(typeof conflict?.local.mtime).toBe("string")
  expect(conflict?.local.sha256).toHaveLength(12)
  expect(conflict?.remote.exists).toBe(true)
  expect(conflict?.remote.size).toBe("remote choice v2".length)
  expect(typeof conflict?.remote.mtime).toBe("string")
  expect(conflict?.remote.updatedAt).toBe(now().toISOString())
  expect(conflict?.remote.updatedBy).toBe("test")
  expect(conflict?.pixels).toBeUndefined()
  expect(await text(f.local, "conflict.txt")).toBe(before)
  expect(await text(f.local, "conflict.remote-conflict.txt")).toBe("remote choice v2")
  expect((await syncResolve({ localDir: f.local, paths: ["missing.txt"] })).conflicts[0]?.action).toBe("error")
})

test("keep local deletes only the copy", async () => {
  const f = await conflictedText()
  const result = await syncResolve({ localDir: f.local, keep: "local" })
  expect(result.summary).toMatchObject({ total: 1, resolved: 1, failed: 0 })
  expect(result.conflicts[0]?.action).toBe("kept-local")
  expect(await exists(f.local, "conflict.remote-conflict.txt")).toBe(false)
  expect(await text(f.local, "conflict.txt")).toBe("local differs")
  expect(await syncResolve({ localDir: f.local })).toMatchObject({ summary: { total: 0 } })
})

test("keep remote replaces contents and deletes the copy", async () => {
  const f = await conflictedText()
  const result = await syncResolve({ localDir: f.local, keep: "remote" })
  expect(result.conflicts[0]?.action).toBe("kept-remote")
  expect(await text(f.local, "conflict.txt")).toBe("remote choice v2")
  expect(await exists(f.local, "conflict.remote-conflict.txt")).toBe(false)
})

test("keep remote restores a missing local original by renaming the copy", async () => {
  const f = await conflictedText()
  await rm(join(f.local, "conflict.txt"))
  const listed = await syncResolve({ localDir: f.local })
  expect(listed.conflicts[0]?.local.exists).toBe(false)
  expect(listed.conflicts[0]?.remote.exists).toBe(true)
  const result = await syncResolve({ localDir: f.local, keep: "remote" })
  expect(result.conflicts[0]?.action).toBe("kept-remote")
  expect(await text(f.local, "conflict.txt")).toBe("remote choice v2")
  expect(await exists(f.local, "conflict.remote-conflict.txt")).toBe(false)
})

test("keep both creates a .remote-copy sibling and refuses to overwrite it", async () => {
  const f = await conflictedText()
  const result = await syncResolve({ localDir: f.local, keep: "both" })
  expect(result.conflicts[0]?.action).toBe("kept-both")
  expect(result.conflicts[0]?.targetPath).toBe("conflict.remote-copy.txt")
  expect(result.conflicts[0]?.targetPath).not.toContain(".remote-conflict")
  expect(await text(f.local, "conflict.remote-copy.txt")).toBe("remote choice v2")
  expect(await text(f.local, "conflict.txt")).toBe("local differs")
  expect(await exists(f.local, "conflict.remote-conflict.txt")).toBe(false)

  const g = await conflictedText()
  await put(g.local, "conflict.remote-copy.txt", "already here")
  const refused = await syncResolve({ localDir: g.local, keep: "both" })
  expect(refused.summary).toMatchObject({ failed: 1, resolved: 0 })
  expect(refused.conflicts[0]?.action).toBe("error")
  expect(refused.conflicts[0]?.error).toContain("already exists")
  expect(await text(g.local, "conflict.remote-conflict.txt")).toBe("remote choice v2")
  expect(await text(g.local, "conflict.txt")).toBe("local differs")
  expect(await text(g.local, "conflict.remote-copy.txt")).toBe("already here")
})

test("explicit unknown paths error without affecting other resolutions", async () => {
  const f = await conflictedText()
  await put(f.local, "second.txt", "local second")
  await put(f.remote, "second.txt", "remote second")
  await f.sync()
  const result = await syncResolve({ localDir: f.local, keep: "local", paths: ["conflict.txt", "nope.txt"] })
  expect(result.summary).toMatchObject({ total: 2, resolved: 1, failed: 1 })
  const byPath = Object.fromEntries(result.conflicts.map((conflict) => [conflict.path, conflict]))
  expect(byPath["conflict.txt"]?.action).toBe("kept-local")
  expect(byPath["nope.txt"]?.action).toBe("error")
  expect(byPath["nope.txt"]?.error).toContain("not an outstanding conflict")
  expect(await exists(f.local, "conflict.remote-conflict.txt")).toBe(false)
  expect(await exists(f.local, "second.remote-conflict.txt")).toBe(true)
})

test("only the requested paths resolve when paths are passed", async () => {
  const f = await conflictedText()
  await put(f.local, "second.txt", "local second")
  await put(f.remote, "second.txt", "remote second")
  await f.sync()
  const result = await syncResolve({ localDir: f.local, keep: "local", paths: ["second.txt"] })
  expect(result.summary).toMatchObject({ total: 1, resolved: 1, failed: 0 })
  expect(await exists(f.local, "second.remote-conflict.txt")).toBe(false)
  expect(await exists(f.local, "conflict.remote-conflict.txt")).toBe(true)
})

test("image conflicts report dimensions and pixel equality", async () => {
  const f = await fixture()
  const red = await sharp({
    create: { width: 4, height: 3, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer()
  const blue = await sharp({
    create: { width: 4, height: 3, channels: 3, background: { r: 0, g: 0, b: 255 } },
  })
    .png()
    .toBuffer()
  await mkdir(join(f.remote), { recursive: true })
  await Bun.write(join(f.remote, "img.png"), blue)
  await f.sync()
  // Same pixels, different bytes: re-encode without compression so the hash differs.
  const redFlat = await sharp(red).png({ compressionLevel: 0 }).toBuffer()
  expect(Buffer.from(redFlat).equals(Buffer.from(red))).toBe(false)
  await Bun.write(join(f.local, "img.png"), red)
  await Bun.write(join(f.remote, "img.png"), redFlat)
  const conflict = await f.sync()
  expect(conflict.summary.conflicts).toBe(1)
  const [differ] = (await syncResolve({ localDir: f.local })).conflicts
  expect(differ?.local).toMatchObject({ exists: true, width: 4, height: 3, format: "png" })
  expect(differ?.remote).toMatchObject({ exists: true, width: 4, height: 3, format: "png" })
  expect(differ?.pixels).toBe("identical")
  await Bun.write(join(f.local, "img.png"), blue)
  const conflicted = await syncResolve({ localDir: f.local })
  expect(conflicted.conflicts[0]?.pixels).toBe("differ")
})

test("resolve --keep remote converges so the next sync is a no-op and the remote is untouched", async () => {
  const f = await conflictedText()
  const remoteBefore = await text(f.remote, "conflict.txt")
  const resolved = await run("resolve", "--local", "local", "--cwd", f.root, "--keep", "remote", "conflict.txt")
  expect(resolved.code).toBe(0)
  expect(resolved.stdout).toContain("⚠ conflict.txt")
  expect(resolved.stdout).toContain("kept remote")
  expect(resolved.stdout).toContain("Run sync to apply")
  expect(await text(f.local, "conflict.txt")).toBe("remote choice v2")
  const again = await f.sync()
  expect(again.summary).toMatchObject({ conflicts: 0, uploads: 0, downloads: 0 })
  expect(await text(f.remote, "conflict.txt")).toBe(remoteBefore)
})

test("resolve --keep local uploads local on the next sync", async () => {
  const f = await conflictedText()
  const resolved = await run("resolve", "--local", "local", "--cwd", f.root, "--keep", "local")
  expect(resolved.code).toBe(0)
  expect(resolved.stdout).toContain("kept local")
  const synced = await f.sync()
  expect(synced.summary).toMatchObject({ conflicts: 0, uploads: 1 })
  expect(await text(f.remote, "conflict.txt")).toBe("local differs")
})

test("resolve lists conflicts, supports --json, and fails closed on unknown paths", async () => {
  const f = await conflictedText()
  const listed = await run("resolve", "--local", "local", "--cwd", f.root)
  expect(listed.code).toBe(0)
  expect(listed.stdout).toContain("⚠ conflict.txt")
  expect(listed.stdout).toContain("bytes")
  expect(listed.stdout).toContain("by test")
  expect(listed.stdout).toContain("Pass --keep local|remote|both to resolve")
  expect(await exists(f.local, "conflict.remote-conflict.txt")).toBe(true)
  const json = await run("resolve", "--local", "local", "--cwd", f.root, "--json")
  expect(json.code).toBe(0)
  const envelope = JSON.parse(json.stdout)
  expect(envelope.success).toBe(true)
  expect(envelope.data.text).toContain("conflict.txt")
  expect(envelope.data.conflicts[0].remote.updatedBy).toBe("test")
  const unknown = await run("resolve", "--local", "local", "--cwd", f.root, "--keep", "local", "nope.txt")
  expect(unknown.code).toBe(1)
  expect(unknown.stderr).toContain("not an outstanding conflict")
  expect(await exists(f.local, "conflict.remote-conflict.txt")).toBe(true)
  const unknownJson = await run("resolve", "--local", "local", "--cwd", f.root, "--keep", "local", "nope.txt", "--json")
  expect(unknownJson.code).toBe(1)
  expect(unknownJson.stderr).toBe("")
  expect(JSON.parse(unknownJson.stdout).success).toBe(false)
})

test("keep local with a missing local file fails closed and the next sync keeps the remote", async () => {
  const f = await conflictedText()
  await rm(join(f.local, "conflict.txt"))
  const result = await syncResolve({ localDir: f.local, keep: "local" })
  expect(result.summary).toMatchObject({ total: 1, resolved: 0, failed: 1 })
  expect(result.conflicts[0]?.action).toBe("error")
  expect(result.conflicts[0]?.error).toContain("Cannot keep local")
  expect(await exists(f.local, "conflict.remote-conflict.txt")).toBe(true)
  const remoteBefore = await text(f.remote, "conflict.txt")
  const catalogBefore = await syncLocalCatalogRead(f.local)
  const after = await f.sync()
  expect(after.summary).toMatchObject({ conflicts: 1, remoteDeletes: 0, uploads: 0 })
  expect(await text(f.remote, "conflict.txt")).toBe(remoteBefore)
  expect(await exists(f.local, "conflict.remote-conflict.txt")).toBe(true)
  expect(await syncLocalCatalogRead(f.local)).toEqual(catalogBefore)
  const cliResolved = await run("resolve", "--local", "local", "--cwd", f.root, "--keep", "local")
  expect(cliResolved.code).toBe(1)
  expect(cliResolved.stderr).toContain("Cannot keep local")
  expect(await exists(f.local, "conflict.remote-conflict.txt")).toBe(true)
})

test("resolve against a nonexistent local directory throws instead of reporting no conflicts", async () => {
  const f = await fixture()
  await expect(syncResolve({ localDir: join(f.local, "missing") })).rejects.toThrow("does not exist")
  const cliMissing = await run("resolve", "--local", "missing", "--cwd", f.root)
  expect(cliMissing.code).toBe(1)
  expect(cliMissing.stderr).toContain("does not exist")
})

test("resolve --keep both creates a synced sibling", async () => {
  const f = await conflictedText()
  const resolved = await run("resolve", "--local", "local", "--cwd", f.root, "--keep", "both")
  expect(resolved.code).toBe(0)
  expect(resolved.stdout).toContain("conflict.remote-copy.txt")
  expect(await text(f.local, "conflict.remote-copy.txt")).toBe("remote choice v2")
  expect(await syncLocalCatalogRead(f.local)).not.toBeNull()
})
