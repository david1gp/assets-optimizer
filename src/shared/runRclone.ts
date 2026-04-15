import * as Bun from "bun"
import type { Logger } from "./logger.js"

export async function runRclone(args: string[], cwd: string, logger?: Logger): Promise<string> {
  const command = ["rclone", ...(logger?.isEnabled(3) ? ["-vv"] : []), ...args]
  logger?.cli(command.join(" "))

  const process = Bun.spawn(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])

  if (exitCode !== 0) {
    throw new Error(`rclone ${args.join(" ")} failed with exit code ${exitCode}\n${stderr || stdout}`.trim())
  }

  if (logger?.isEnabled(3)) {
    if (stdout.trim()) {
      logger.verbose(stdout.trim())
    }
    if (stderr.trim()) {
      logger.verbose(stderr.trim())
    }
  }

  return stdout.trim()
}
