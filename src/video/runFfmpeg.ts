import * as Bun from "bun"

export async function runFfmpeg(args: string[], cwd: string): Promise<void> {
  const process = Bun.spawn(["ffmpeg", ...args], {
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
}
