import * as Bun from "bun"

const MIN_RCLONE_VERSION = "1.66.0"

interface RcloneVersionProcess {
  stdout: ReadableStream
  stderr: ReadableStream
  exited: Promise<number>
}

interface RcloneVersionSpawnOptions {
  cmd: string[]
  stdout: "pipe"
  stderr: "pipe"
}

type RcloneVersionSpawn = (options: RcloneVersionSpawnOptions) => RcloneVersionProcess

function parseVersion(raw: string): [number, number, number] | null {
  const match = raw.match(/(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function isAtLeast(actual: [number, number, number], minimum: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    const a = actual[i] ?? 0
    const m = minimum[i] ?? 0
    if (a > m) return true
    if (a < m) return false
  }
  return true
}

/**
 * Bisync --create-empty-src-dirs requires rclone >= 1.66.
 * Older distro packages (e.g. Debian's 1.60.1) reject the flag.
 */
export async function assertRcloneVersion(
  spawnRclone: RcloneVersionSpawn = (options) => Bun.spawn(options),
): Promise<void> {
  const proc = spawnRclone({
    cmd: ["rclone", "version"],
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, errorOutput, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  if (exitCode !== 0) {
    throw new Error(`rclone version failed: ${errorOutput.trim() || `exit code ${exitCode}`}`)
  }

  const firstLine = stdout.split("\n")[0] ?? ""
  const actual = parseVersion(firstLine)
  const minimum = parseVersion(MIN_RCLONE_VERSION)
  if (!actual || !minimum) {
    throw new Error(`Unable to parse rclone version from: ${firstLine}`)
  }

  if (!isAtLeast(actual, minimum)) {
    throw new Error(
      `rclone ${actual.join(".")} is too old; need >= ${MIN_RCLONE_VERSION} ` +
        `(for bisync --create-empty-src-dirs). Upgrade via https://rclone.org/install/`,
    )
  }
}
