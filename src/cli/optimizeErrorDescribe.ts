type OptimizeErrorType = "validation" | "runtime"

export function optimizeErrorDescribe(error: unknown): { readonly type: OptimizeErrorType; readonly message: string } {
  return {
    type: isValidationError(error) ? "validation" : "runtime",
    message: getErrorMessage(error),
  }
}

function isValidationError(error: unknown): boolean {
  return error instanceof TypeError && error.message.startsWith("Invalid assetsOptimize options:")
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
