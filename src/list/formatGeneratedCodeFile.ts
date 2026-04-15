import type { Logger } from "../shared/logger.js"

export async function formatGeneratedCodeFile(outputPath: string, logger?: Logger): Promise<void> {
  const command = ["bunx", "biome", "check", "--write", outputPath]
  logger?.cli(command.join(" "))

  const process = Bun.spawn(command, {
    stdout: "pipe",
    stderr: "pipe",
  })

  const exitCode = await process.exited
  if (exitCode !== 0) {
    const stderr = await new Response(process.stderr).text()
    const message = `Failed to format generated file ${outputPath}: ${stderr}`
    if (logger) {
      logger.warn(message)
    } else {
      console.warn(message)
    }
    return
  }

  if (logger?.isEnabled(3)) {
    const [stdout, stderr] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ])
    if (stdout.trim()) {
      logger.verbose(stdout.trim())
    }
    if (stderr.trim()) {
      logger.verbose(stderr.trim())
    }
  }
}
