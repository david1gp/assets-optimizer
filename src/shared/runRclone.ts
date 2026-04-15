import * as Bun from "bun"

export async function runRclone(args: string[], cwd: string): Promise<string> {
  const process = Bun.spawn(["rclone", ...args], {
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

  return stdout.trim()
}
