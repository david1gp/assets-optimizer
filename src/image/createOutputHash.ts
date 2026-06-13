import { createHash } from "node:crypto"

export function createOutputHash(sourceBuffer: Buffer, transformSpec: string, hashLength = 8): string {
  return createHash("sha256").update(sourceBuffer).update(transformSpec).digest("hex").slice(0, hashLength)
}
