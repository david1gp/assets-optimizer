import { runRcloneCapture } from "../rclone/runRcloneCapture.js"
import { syncRemoteRun } from "./syncRemoteRun.js"

export async function syncRemoteTrashPurge(remote: string, days: number, now = new Date()): Promise<void> {
  const dir = `${remote}/.assets-sync/trash`
  const result = await runRcloneCapture(["lsjson", dir, "--dirs-only"])
  if (result.exitCode !== 0) {
    if (result.exitCode === 3 || /(?:not found|does(?:n't| not) exist|no such file or directory)/i.test(result.stderr))
      return
    throw new Error(`rclone lsjson failed (${result.exitCode}): ${result.stderr}`)
  }
  const dirs = JSON.parse(result.stdout) as { Name: string }[]
  for (const { Name: name } of dirs) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue
    const date = new Date(`${name}T00:00:00.000Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== name) continue
    if (date.getTime() < now.getTime() - days * 86400000) await syncRemoteRun(["purge", `${dir}/${name}`])
  }
}
