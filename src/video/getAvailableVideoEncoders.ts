import * as Bun from "bun"

let availableEncodersPromise: Promise<Set<string>> | undefined

export async function getAvailableVideoEncoders(cwd: string): Promise<Set<string>> {
  if (!availableEncodersPromise) {
    availableEncodersPromise = (async () => {
      const process = Bun.spawn(["ffmpeg", "-hide_banner", "-encoders"], {
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
