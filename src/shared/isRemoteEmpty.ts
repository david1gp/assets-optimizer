import * as Bun from "bun"

interface RcloneSizeProcess {
  stdout: ReadableStream
  stderr: ReadableStream
  exited: Promise<number>
}

interface RcloneSizeSpawnOptions {
  cmd: string[]
  stdout: "pipe"
  stderr: "pipe"
}

type RcloneSizeSpawn = (options: RcloneSizeSpawnOptions) => RcloneSizeProcess

export async function isRemoteEmpty(
  remote: string,
  spawnRclone: RcloneSizeSpawn = (options) => Bun.spawn(options),
): Promise<boolean> {
  const proc = spawnRclone({
    cmd: ["rclone", "size", "--json", remote],
    stdout: "pipe",
    stderr: "pipe",
  })
  const [output, errorOutput, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  if (exitCode !== 0) {
    throw new Error(`rclone size failed for ${remote}: ${errorOutput.trim() || `exit code ${exitCode}`}`)
  }

  try {
    const result = JSON.parse(output) as { count?: unknown }
    if (typeof result.count !== "number") {
      throw new Error("missing numeric count")
    }

    return result.count === 0
  } catch (error) {
    throw new Error(
      `Unable to parse rclone size output for ${remote}: ${error instanceof Error ? error.message : error}`,
    )
  }
}
