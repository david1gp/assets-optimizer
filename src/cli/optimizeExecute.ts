import type { AssetsOptimizeOptions } from "../AssetsOptimizeOptions.js"
import type { AssetsOptimizeResult } from "../AssetsOptimizeResult.js"
import { assetsOptimize } from "../assetsOptimize.js"

export async function optimizeExecute(
  options: AssetsOptimizeOptions,
  diagnostics: string[],
): Promise<AssetsOptimizeResult> {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  }
  const capture = (...args: unknown[]): void => {
    diagnostics.push(args.map((arg) => String(arg)).join(" "))
  }

  console.log = capture
  console.warn = capture
  console.error = capture

  try {
    return await assetsOptimize(options)
  } finally {
    console.log = originalConsole.log
    console.warn = originalConsole.warn
    console.error = originalConsole.error
  }
}
