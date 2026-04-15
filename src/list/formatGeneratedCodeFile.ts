export async function formatGeneratedCodeFile(outputPath: string): Promise<void> {
  const process = Bun.spawn(["bunx", "biome", "check", "--write", outputPath], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const exitCode = await process.exited
  if (exitCode !== 0) {
    const stderr = await new Response(process.stderr).text()
    console.warn(`Failed to format generated file ${outputPath}: ${stderr}`)
  }
}
