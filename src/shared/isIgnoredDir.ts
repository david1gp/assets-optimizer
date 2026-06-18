export const defaultIgnoredDirNames = [".git", "ignore", "discarded", "skipped", "staging"] as const

/**
 * Matching directories are skipped entirely during traversal and never reported.
 */
export function isIgnoredDir(name: string, ignoredDirNames: readonly string[] = []): boolean {
  const normalizedName = name.toLowerCase()
  return [...defaultIgnoredDirNames, ...ignoredDirNames].some((ignoredName) => {
    const normalizedIgnoredName = ignoredName.trim().toLowerCase()
    return normalizedIgnoredName !== "" && normalizedName.includes(normalizedIgnoredName)
  })
}
