import { runRcloneCapture } from "../rclone/runRcloneCapture.js"

export async function syncRemoteReadOptional(path: string): Promise<string | null> {
  const result = await runRcloneCapture(["cat", path])
  // B2/S3 backends answer `cat` of a missing object with exit 0 and no bytes
  // (local dirs exit 3 instead). Callers never store legitimately empty files.
  if (result.exitCode === 0) return result.stdout === "" ? null : result.stdout
  if (result.exitCode === 3 || /(?:not found|does(?:n't| not) exist|no such file or directory)/i.test(result.stderr))
    return null
  throw new Error(`rclone cat ${path} failed (${result.exitCode}): ${result.stderr}`)
}
