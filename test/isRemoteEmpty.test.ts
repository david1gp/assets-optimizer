import { describe, expect, test } from "bun:test"
import { isRemoteEmpty } from "../src/shared/isRemoteEmpty.js"

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

describe("isRemoteEmpty", () => {
  test("checks the full remote tree", async () => {
    const rclone = createRcloneSpawn('{"count":2}\n')

    await expect(isRemoteEmpty("gdrive:project/images", rclone.spawn)).resolves.toBe(false)
    expect(rclone.calls).toEqual([["rclone", "size", "--json", "gdrive:project/images"]])
  })

  test("reports an empty remote when rclone returns zero files", async () => {
    const rclone = createRcloneSpawn('{"count":0}\n')

    await expect(isRemoteEmpty("gdrive:project/images", rclone.spawn)).resolves.toBe(true)
  })

  test("does not treat rclone failures as empty remotes", async () => {
    const rclone = createRcloneSpawn("", "permission denied", 7)

    await expect(isRemoteEmpty("gdrive:project/images", rclone.spawn)).rejects.toThrow("rclone size failed")
  })

  test("does not treat invalid rclone output as an empty remote", async () => {
    const rclone = createRcloneSpawn("not json\n")

    await expect(isRemoteEmpty("gdrive:project/images", rclone.spawn)).rejects.toThrow(
      "Unable to parse rclone size output",
    )
  })
})
