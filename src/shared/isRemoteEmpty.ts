import * as Bun from "bun"

export async function isRemoteEmpty(remote: string): Promise<boolean> {
  const proc = Bun.spawn({
    cmd: ["rclone", "size", "--json", "--max-depth", "1", remote],
    stdout: "pipe",
    stderr: "pipe",
  })
  const output = await new Response(proc.stdout).text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    return true
  }

  try {
    const result = JSON.parse(output) as { count: number }
    return result.count === 0
  } catch {
    return true
  }
}
