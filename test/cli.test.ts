import { describe, expect, test } from "bun:test"
import path from "node:path"
import { assetsOptimize, optimizeImages, processAssets } from "../src/index.js"

const cliPath = path.resolve(import.meta.dir, "../src/cli/assetsOptimizerCli.ts")
const disabledOptions = {
  processImages: false,
  processVideos: false,
  processFonts: false,
}

const typedDisabledFlags = ["--no-process-images", "--no-process-videos", "--no-process-fonts"]

interface CliResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

type CliPayload = Record<string, unknown> & {
  readonly success: boolean
}

describe("assets-optimizer CLI", () => {
  test("reports help as a successful JSON result", async () => {
    const result = await runCli("optimize", "--help")

    expect(result.exitCode).toBe(0)
    const payload = readPayload(result)
    expect(payload).toMatchObject({ success: true })
    const help = (payload.data as { readonly help: string }).help
    expect(help).toContain("assets-optimizer optimize")
    expect(help).toContain("--no-process-images")
    expect(help).toContain("--ai-label-mode")
    expect(help).not.toContain("--options")
  })

  test("runs the optimize command with typed flags", async () => {
    const result = await runCli(
      "optimize",
      ...typedDisabledFlags,
      "--cwd",
      ".",
      "--log-level",
      "3",
      "--image-originals-dir",
      "images",
      "--image-optimized-dir",
      "public/images",
      "--allow-root-image-files",
      "--image-hash-length",
      "8",
      "--ignored-dir-names",
      "cache",
      "--ignored-dir-names",
      "tmp",
      "--image-filter-dirs",
      "marketing",
      "--image-filter-dirs",
      "product",
      "--ai-label-mode",
      "adaptive",
      "--ai-label-simple-color",
      "white",
      "--ai-label-visual",
      "circle",
      "--ai-label-opacity",
      "50%",
      "--ai-label-placement",
      "bottom-right",
      "--ai-label-height",
      "32",
      "--ai-label-offset-x",
      "-1.5",
      "--ai-label-offset-y",
      "2",
      "--image-type-import-path",
      "./Image",
      "--image-list-output-path",
      "./imageList.ts",
      "--no-generate-image-list",
      "--video-originals-dir",
      "videos",
      "--video-optimized-dir",
      "public/videos",
      "--video-list-output-path",
      "./videoList.ts",
      "--no-generate-video-list",
      "--video-preview-quality",
      "65",
      "--video-preview-hash-length",
      "8",
      "--font-originals-dir",
      "fonts",
      "--font-optimized-dir",
      "public/fonts",
      "--font-list-output-path",
      "./fontList.ts",
      "--no-generate-font-list",
    )

    expect(result.exitCode).toBe(0)
    expect(readPayload(result)).toMatchObject({ success: true })
  })

  test("reports constrained number failures as command errors", async () => {
    const result = await runCli("optimize", "--image-hash-length", "0")

    expect(result.exitCode).toBe(1)
    expect(readPayload(result)).toMatchObject({
      success: false,
      error: { type: "command" },
    })
  })

  test("reports enum failures as command errors", async () => {
    const result = await runCli("optimize", "--ai-label-mode", "invalid")

    expect(result.exitCode).toBe(1)
    expect(readPayload(result)).toMatchObject({
      success: false,
      error: { type: "command" },
    })
  })

  test("reports unknown commands as a command failure", async () => {
    const result = await runCli("unknown")

    expect(result.exitCode).toBe(1)
    expect(readPayload(result)).toMatchObject({
      success: false,
      error: { type: "command" },
    })
  })

  test("reports optimizer errors as runtime failures", async () => {
    const result = await runCli(
      "optimize",
      "--cwd",
      import.meta.dir,
      "--image-originals-dir",
      "../package.json",
      "--no-process-videos",
      "--no-process-fonts",
      "--no-generate-image-list",
    )

    expect(result.exitCode).toBe(1)
    expect(readPayload(result)).toMatchObject({
      success: false,
      error: { type: "runtime" },
    })
  })
})

describe("public library imports", () => {
  test("keeps existing optimizer exports usable", async () => {
    expect(typeof assetsOptimize).toBe("function")
    expect(typeof optimizeImages).toBe("function")
    expect(typeof processAssets).toBe("function")

    const result = await assetsOptimize(disabledOptions)

    expect(result.processed).toEqual([])
  })
})

async function runCli(...args: string[]): Promise<CliResult> {
  const child = Bun.spawn([process.execPath, cliPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  })
  const stdout = new Response(child.stdout).text()
  const stderr = new Response(child.stderr).text()
  const [exitCode, output, errorOutput] = await Promise.all([child.exited, stdout, stderr])

  return { exitCode, stdout: output, stderr: errorOutput }
}

function readPayload(result: CliResult): CliPayload {
  expect(result.stderr).toBe("")
  expect(result.stdout.endsWith("\n")).toBe(true)

  const lines = result.stdout.trim().split("\n")
  expect(lines).toHaveLength(1)

  const payload = JSON.parse(result.stdout) as CliPayload
  expect(typeof payload.success).toBe("boolean")
  return payload
}
