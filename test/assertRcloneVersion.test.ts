import { describe, expect, test } from "bun:test"
import { assertRcloneVersion } from "../src/rclone/assertRcloneVersion.js"

function streamFromText(text: string): ReadableStream {
  const stream = new Response(text).body
  if (stream === null) {
    throw new Error("Unable to create response stream")
  }

  return stream
}

function createRcloneSpawn(output: string, errorOutput = "", exitCode = 0) {
  const calls: string[][] = []

  return {
    calls,
    spawn: (options: { cmd: string[]; stdout: "pipe"; stderr: "pipe" }) => {
      calls.push(options.cmd)

      return {
        stdout: streamFromText(output),
        stderr: streamFromText(errorOutput),
        exited: Promise.resolve(exitCode),
      }
    },
  }
}

describe("assertRcloneVersion", () => {
  test("accepts rclone >= 1.66", async () => {
    const rclone = createRcloneSpawn("rclone v1.74.4\n- os/version: debian\n")
    await expect(assertRcloneVersion(rclone.spawn)).resolves.toBeUndefined()
    expect(rclone.calls).toEqual([["rclone", "version"]])
  })

  test("accepts the minimum version", async () => {
    const rclone = createRcloneSpawn("rclone v1.66.0\n")
    await expect(assertRcloneVersion(rclone.spawn)).resolves.toBeUndefined()
  })

  test("rejects older distro packages that lack --create-empty-src-dirs", async () => {
    const rclone = createRcloneSpawn("rclone v1.60.1-DEV\n")
    await expect(assertRcloneVersion(rclone.spawn)).rejects.toThrow(/rclone 1\.60\.1 is too old; need >= 1\.66\.0/)
  })

  test("rejects rclone version failures", async () => {
    const rclone = createRcloneSpawn("", "command not found", 127)
    await expect(assertRcloneVersion(rclone.spawn)).rejects.toThrow("rclone version failed")
  })

  test("rejects unparseable version output", async () => {
    const rclone = createRcloneSpawn("not a version line\n")
    await expect(assertRcloneVersion(rclone.spawn)).rejects.toThrow("Unable to parse rclone version")
  })
})
