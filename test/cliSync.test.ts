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
