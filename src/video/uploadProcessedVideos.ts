import path from "node:path"
import type { OptimizeImagesWebResult } from "../OptimizeImagesWebResult.js"
import { listLocalFiles } from "../shared/listLocalFiles.js"
import { listRemoteFiles } from "../shared/listRemoteFiles.js"
import { remotePathExists } from "../shared/remotePathExists.js"
import { runRclone } from "../shared/runRclone.js"

export async function uploadProcessedVideos(
  processedVideosDir: string,
  remoteVideoProcessed: string,
  cacheControlHeader: string,
  cwd: string,
  result: OptimizeImagesWebResult,
): Promise<void> {
  const localProcessedVideos = await listLocalFiles(processedVideosDir)
  if (localProcessedVideos.length === 0) {
    return
  }

  const hasRemoteProcessedVideosDir = await remotePathExists(remoteVideoProcessed, cwd)
  const remoteProcessedVideos = hasRemoteProcessedVideosDir
    ? new Set(await listRemoteFiles(remoteVideoProcessed, cwd))
    : new Set<string>()

  if (!hasRemoteProcessedVideosDir) {
    await runRclone(["mkdir", remoteVideoProcessed], cwd)
  }

  for (const localFile of localProcessedVideos) {
    const relativePath = path.relative(processedVideosDir, localFile)
    if (relativePath.startsWith(".") || remoteProcessedVideos.has(relativePath)) {
      continue
    }

    await runRclone(
      [
        "copyto",
        "--header-upload",
        `Cache-Control: ${cacheControlHeader}`,
        localFile,
        `${remoteVideoProcessed}/${relativePath}`,
      ],
      cwd,
    )
    result.uploadedRemoteVideos.push(relativePath)
  }
}
