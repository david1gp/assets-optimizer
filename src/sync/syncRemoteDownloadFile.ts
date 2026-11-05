import { syncRemoteRun } from "./syncRemoteRun.js"

export async function syncRemoteDownloadFile(remoteFile: string, localFile: string): Promise<void> {
  await syncRemoteRun(["copyto", remoteFile, localFile])
}
