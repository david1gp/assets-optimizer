export async function runRcloneCapture(
  args: string[],
  cwd = process.cwd(),
  stdin?: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["rclone", ...args], {
    cwd,
    stdin: stdin === undefined ? "ignore" : "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })
  if (stdin !== undefined && proc.stdin != null && typeof proc.stdin !== "number") {
    proc.stdin.write(stdin)
    proc.stdin.end()
  }
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  return { exitCode, stdout, stderr }
}
