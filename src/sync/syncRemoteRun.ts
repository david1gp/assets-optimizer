import { runRcloneCapture } from "../rclone/runRcloneCapture.js"

export async function syncRemoteRun(args: string[], stdin?: string): Promise<string> {
  const result = await runRcloneCapture(args, process.cwd(), stdin)
  if (result.exitCode !== 0) throw new Error(`rclone ${args.join(" ")} failed (${result.exitCode}): ${result.stderr}`)
  return result.stdout
}
