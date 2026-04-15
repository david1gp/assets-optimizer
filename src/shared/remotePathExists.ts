import * as Bun from "bun"
import type { Logger } from "./logger.js"

export async function remotePathExists(remotePath: string, cwd: string, logger?: Logger): Promise<boolean> {
  const command = ["rclone", "lsf", remotePath]
  logger?.cli(command.join(" "))

  const process = Bun.spawn(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text()])
  const exitCode = await process.exited

  if (logger?.isEnabled(3)) {
    if (stdout.trim()) {
      logger.verbose(stdout.trim())
    }
    if (stderr.trim()) {
      logger.verbose(stderr.trim())
    }
  }

  return exitCode === 0
}
