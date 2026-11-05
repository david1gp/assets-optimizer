import { runRcloneCapture } from "../rclone/runRcloneCapture.js"

export async function syncRemoteReadOptional(path: string): Promise<string | null> {
  const result = await runRcloneCapture(["cat", path])
  if (result.exitCode === 0) return result.stdout
  if (result.exitCode === 3 || /(?:not found|does(?:n't| not) exist|no such file or directory)/i.test(result.stderr))
    return null
  throw new Error(`rclone cat ${path} failed (${result.exitCode}): ${result.stderr}`)
}
