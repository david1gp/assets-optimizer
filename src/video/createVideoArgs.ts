import type { Logger } from "../shared/logger.js"
import { getAvailableVideoEncoders } from "./getAvailableVideoEncoders.js"

export async function createVideoArgs(
  sourcePath: string,
  outputPath: string,
  extension: string,
  cwd: string,
  logger?: Logger,
): Promise<string[]> {
  const commonArgs = ["-y", "-i", sourcePath, "-map", "0:v:0", "-map", "0:a?", "-map_metadata", "-1"]

  if (extension === ".webm") {
    return [
      ...commonArgs,
      "-c:v",
      "libvpx-vp9",
      "-row-mt",
      "1",
      "-crf",
      "36",
      "-b:v",
      "0",
      "-c:a",
      "libopus",
      "-b:a",
      "96k",
      outputPath,
    ]
  }

  const availableEncoders = await getAvailableVideoEncoders(cwd, logger)
  if (availableEncoders.has("libx264")) {
    return [
      ...commonArgs,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "28",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ]
  }

  if (availableEncoders.has("libopenh264")) {
    return [
      ...commonArgs,
      "-c:v",
      "libopenh264",
      "-b:v",
      "1000k",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ]
  }

  return [
    ...commonArgs,
    "-c:v",
    "mpeg4",
    "-q:v",
    "5",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ]
}
