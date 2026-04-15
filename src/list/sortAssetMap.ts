export function sortAssetMap<T>(assetMap: Record<string, T>): Record<string, T> {
  return Object.keys(assetMap)
    .sort()
    .reduce(
      (sorted, key) => {
        sorted[key] = assetMap[key]!
        return sorted
      },
      {} as Record<string, T>,
    )
}
