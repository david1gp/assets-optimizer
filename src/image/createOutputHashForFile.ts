import { createHash } from "node:crypto"
import fs from "node:fs"

export async function createOutputHashForFile(sourcePath: string, transformSpec: string): Promise<string> {
  const hash = createHash("sha256")

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(sourcePath)
    stream.on("data", (chunk) => {
      hash.update(chunk)
    })
    stream.on("end", resolve)
    stream.on("error", reject)
  })

  return hash.update(transformSpec).digest("hex").slice(0, 8)
}
