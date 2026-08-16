import type { ApplicationContext } from "@stricli/core"
import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"

type OptimizeEnvelope =
  | {
      readonly success: true
      readonly data: AssetsOptimizeResult
      readonly diagnostics?: readonly string[]
    }
  | {
      readonly success: false
      readonly error: {
        readonly type: "validation" | "runtime"
        readonly message: string
      }
      readonly diagnostics?: readonly string[]
    }

export function optimizeEnvelopeWrite(
  context: ApplicationContext,
  envelope: OptimizeEnvelope,
  diagnostics: readonly string[],
): void {
  context.process.stdout.write(`${JSON.stringify(addDiagnostics(envelope, diagnostics))}\n`)
}

function addDiagnostics<T extends OptimizeEnvelope>(envelope: T, diagnostics: readonly string[]): T {
  if (diagnostics.length === 0) {
    return envelope
  }

  return { ...envelope, diagnostics } as T
}
