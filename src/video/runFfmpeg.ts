import * as Bun from "bun"
import type { Logger } from "../shared/logger.js"

export async function runFfmpeg(args: string[], cwd: string, logger?: Logger): Promise<void> {
  const command = ["ffmpeg", ...args]
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
    throw new Error(`ffmpeg ${args.join(" ")} failed with exit code ${exitCode}\n${stderr || stdout}`.trim())
  }

  if (logger?.isEnabled(3)) {
    if (stdout.trim()) {
      logger.verbose(stdout.trim())
    }
    if (stderr.trim()) {
      logger.verbose(stderr.trim())
    }
  }
}
