export function isConflictFile(name: string): boolean {
  return name.includes(".remote-conflict.") || name.endsWith(".remote-conflict")
}
