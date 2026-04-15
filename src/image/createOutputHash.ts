import { createHash } from "node:crypto"

export function createOutputHash(sourceBuffer: Buffer, transformSpec: string): string {
  return createHash("sha256").update(sourceBuffer).update(transformSpec).digest("hex").slice(0, 8)
}
