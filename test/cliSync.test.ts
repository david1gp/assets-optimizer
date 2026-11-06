import { expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

const cli = resolve(import.meta.dir, "../src/cli/assetsOptimizerCli.ts")

async function run(...args: string[]) {
  const child = Bun.spawn([process.execPath, cli, ...args], { stdout: "pipe", stderr: "pipe" })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { code, stdout, stderr }
}

test("help lists status and sync commands", async () => {
  const result = await run("--help")
  expect(result.code).toBe(0)
  expect(JSON.parse(result.stdout).data.help).toContain("status")
  expect(JSON.parse(result.stdout).data.help).toContain("sync")
})

test.each([
  { paths: ["same.jpg", "same.jpg"], exitCode: 0, message: "Duplicate remote sync path" },
  { paths: ["folder", "folder"], exitCode: 0, message: "Duplicate remote sync path" },
  { paths: ["../outside.jpg"], exitCode: 0, message: "Invalid remote sync path" },
  { paths: ["/outside.jpg"], exitCode: 0, message: "Invalid remote sync path" },
  { paths: ["safe.jpg"], exitCode: 3, message: "rclone lsjson failed" },
])(
  "status fails closed for ambiguous, unsafe or partially failed listings %#",
  async ({ paths, exitCode, message }) => {
    const root = await mkdtemp("/tmp/opencode/cli-sync-list-")
    try {
      const bin = join(root, "bin")
      await mkdir(bin)
      const fakeRclone = join(bin, "rclone")
      await writeFile(
        fakeRclone,
        '#!/bin/sh\nif [ "$1" = "cat" ]; then exit 3; fi\nprintf "%s" "$SYNC_TEST_LISTING"\nexit "$SYNC_TEST_EXIT"\n',
      )
      await chmod(fakeRclone, 0o755)
      const child = Bun.spawn(
        [process.execPath, cli, "status", "--local", join(root, "local"), "--remote", "test:originals"],
        {
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            SYNC_TEST_LISTING: JSON.stringify(
              paths.map((Path) => ({ Path, Size: 1, ModTime: "2026-11-05T00:00:00Z", IsDir: Path === "folder" })),
            ),
            SYNC_TEST_EXIT: String(exitCode),
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(code).toBe(1)
      expect(stdout).toBe("")
      expect(stderr).toContain(message)
      expect(await Bun.file(join(root, "local/.assets-sync/catalog.json")).exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  },
)

test("status plans and sync uploads originals to a local remote", async () => {
  const root = await mkdtemp("/tmp/opencode/cli-sync-")
  try {
    await mkdir(join(root, "local"))
    await mkdir(join(root, "remote"))
    await writeFile(join(root, "local", "test.txt"), "hello")
    const args = ["--local", "local", "--remote", "remote", "--cwd", root]
    const status = await run("status", ...args)
    expect(status.code).toBe(0)
    expect(status.stdout).toContain("↑ upload test.txt")
    expect(status.stdout).toContain("Planned: 1 uploads")
    const jsonStatus = await run("status", ...args, "--json")
    expect(JSON.parse(jsonStatus.stdout).data.text).toContain("↑ upload test.txt")
    expect(jsonStatus.stderr).toBe("")
    const sync = await run("sync", ...args)
    expect(sync.code).toBe(0)
    expect(sync.stdout).toMatch(/1 uploaded, 0 downloaded, 0 deleted → catalog v\d+/)
    expect(await readFile(join(root, "remote", "test.txt"), "utf8")).toBe("hello")
    const current = await run("status", ...args)
    expect(current.stdout).toMatch(/Up to date \(catalog v\d+\)/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("sync exits non-zero with pending conflicts but still syncs other paths", async () => {
  const root = await mkdtemp("/tmp/opencode/cli-sync-conflict-")
  try {
    await mkdir(join(root, "a"))
    await mkdir(join(root, "b"))
    await mkdir(join(root, "remote"))
    await writeFile(join(root, "remote", "conflict.txt"), "base")
    const a = ["sync", "--local", "a", "--remote", "remote", "--cwd", root]
    const b = ["sync", "--local", "b", "--remote", "remote", "--cwd", root]
    expect((await run(...a)).code).toBe(0)
    expect((await run(...b)).code).toBe(0)
    await writeFile(join(root, "a", "conflict.txt"), "A edit")
    await writeFile(join(root, "b", "conflict.txt"), "B edit")
    await writeFile(join(root, "b", "other.txt"), "synced despite the conflict")
    expect((await run(...a)).code).toBe(0)
    const conflicted = await run(...b)
    expect(conflicted.code).toBe(1)
    expect(conflicted.stdout).toBe("")
    expect(conflicted.stderr).toContain("unresolved conflict(s); other paths were synced")
    expect(conflicted.stderr).toContain("⚠ conflict conflict.txt")
    expect(await readFile(join(root, "remote", "other.txt"), "utf8")).toBe("synced despite the conflict")
    expect(await readFile(join(root, "b", "conflict.remote-conflict.txt"), "utf8")).toBe("A edit")
    const status = await run("status", "--local", "b", "--remote", "remote", "--cwd", root)
    expect(status.code).toBe(0)
    expect(status.stdout).toContain("⚠ conflict conflict.txt")
    const json = await run(...b, "--json")
    expect(json.code).toBe(1)
    expect(json.stderr).toBe("")
    const envelope = JSON.parse(json.stdout)
    expect(envelope.success).toBe(false)
    expect(envelope.error.message).toContain("other paths were synced")
    expect(envelope.data.summary.conflicts).toBe(1)
    const preferred = await run(...b, "--prefer", "remote")
    expect(preferred.code).toBe(0)
    expect(await readFile(join(root, "b", "conflict.txt"), "utf8")).toBe("A edit")
    const today = new Date().toISOString().slice(0, 10)
    expect(await readFile(join(root, "b", ".assets-sync/trash", today, "conflict.txt"), "utf8")).toBe("B edit")
    expect(await Bun.file(join(root, "b", "conflict.remote-conflict.txt")).exists()).toBe(false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("sync errors are plain text by default and JSON with --json", async () => {
  const args = ["--local", "local", "--remote", "remote", "--cwd", "/dev/null"]
  const plain = await run("sync", ...args)
  expect(plain.code).toBe(1)
  expect(plain.stdout).toBe("")
  expect(plain.stderr).not.toBe("")
  const json = await run("sync", ...args, "--json")
  expect(json.code).toBe(1)
  expect(json.stderr).toBe("")
  expect(JSON.parse(json.stdout).success).toBe(false)
})
