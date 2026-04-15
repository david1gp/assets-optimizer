import * as Bun from "bun"

export async function remotePathExists(remotePath: string, cwd: string): Promise<boolean> {
  const process = Bun.spawn(["rclone", "lsf", remotePath], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })

  await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text()])
  const exitCode = await process.exited
  return exitCode === 0
}
