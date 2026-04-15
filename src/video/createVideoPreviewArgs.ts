export function createVideoPreviewArgs(inputPath: string, outputPath: string, quality: number): string[] {
  return [
    "-y",
    "-i",
    inputPath,
    "-vf",
    "thumbnail",
    "-frames:v",
    "1",
    "-q:v",
    String(mapJpegQualityToQScale(quality)),
    outputPath,
  ]
}

function mapJpegQualityToQScale(quality: number): number {
  const normalizedQuality = Math.max(1, Math.min(100, Math.round(quality)))
  return Math.max(2, Math.min(31, Math.round(31 - ((normalizedQuality - 1) / 99) * 29)))
}
