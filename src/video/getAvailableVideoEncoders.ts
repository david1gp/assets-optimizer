import * as Bun from "bun"
import type { Logger } from "../shared/logger.js"

let availableEncodersPromise: Promise<Set<string>> | undefined

export async function getAvailableVideoEncoders(cwd: string, logger?: Logger): Promise<Set<string>> {
  if (!availableEncodersPromise) {
    availableEncodersPromise = (async () => {
      const command = ["ffmpeg", "-hide_banner", "-encoders"]
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
        throw new Error(`ffmpeg -encoders failed with exit code ${exitCode}\n${stderr || stdout}`.trim())
      }

      if (logger?.isEnabled(3)) {
        if (stdout.trim()) {
          logger.verbose(stdout.trim())
        }
        if (stderr.trim()) {
          logger.verbose(stderr.trim())
        }
      }

      return new Set(
        stdout
          .split("\n")
          .map((line) => line.trim().split(/\s+/)[1])
          .filter((value): value is string => Boolean(value)),
      )
    })()
  }

  return availableEncodersPromise
}
