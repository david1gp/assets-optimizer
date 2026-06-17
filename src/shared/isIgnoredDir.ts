/**
 * Directories whose name contains "ignore" (e.g. "ignored", "_ignore") are
 * skipped entirely during traversal and never reported as skipped/ignored.
 */
export function isIgnoredDir(name: string): boolean {
  return name.toLowerCase().includes("ignore")
}
