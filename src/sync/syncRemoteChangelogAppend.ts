import { syncRemoteReadOptional } from "./syncRemoteReadOptional.js"
import { syncRemoteRun } from "./syncRemoteRun.js"

export async function syncRemoteChangelogAppend(remote: string, lines: string[]): Promise<void> {
  if (!lines.length) return
  const path = `${remote}/.assets-sync/changelog.jsonl`
  const old = (await syncRemoteReadOptional(path)) ?? ""
  await syncRemoteRun(
    ["rcat", path],
    `${old}${old && !old.endsWith("\n") ? "\n" : ""}${lines.map((line) => line.replace(/\n+$/, "")).join("\n")}\n`,
  )
}
