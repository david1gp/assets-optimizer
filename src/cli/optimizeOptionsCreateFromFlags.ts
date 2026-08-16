import type { AssetsOptimizeOptions } from "../AssetsOptimizeOptions.js"

type AiLabelFlags = {
  readonly aiLabelMode?: NonNullable<AssetsOptimizeOptions["aiLabelOptions"]>["mode"]
  readonly aiLabelSimpleColor?: NonNullable<AssetsOptimizeOptions["aiLabelOptions"]>["simpleColor"]
  readonly aiLabelVisual?: NonNullable<AssetsOptimizeOptions["aiLabelOptions"]>["visual"]
  readonly aiLabelOpacity?: NonNullable<AssetsOptimizeOptions["aiLabelOptions"]>["opacity"]
  readonly aiLabelPlacement?: NonNullable<AssetsOptimizeOptions["aiLabelOptions"]>["placement"]
  readonly aiLabelHeight?: NonNullable<AssetsOptimizeOptions["aiLabelOptions"]>["height"]
  readonly aiLabelOffsetX?: NonNullable<AssetsOptimizeOptions["aiLabelOptions"]>["offsetX"]
  readonly aiLabelOffsetY?: NonNullable<AssetsOptimizeOptions["aiLabelOptions"]>["offsetY"]
}

type OptimizeFlags = Omit<AssetsOptimizeOptions, "aiLabelOptions"> & AiLabelFlags

export function optimizeOptionsCreateFromFlags(flags: OptimizeFlags): AssetsOptimizeOptions {
  const {
    aiLabelMode,
    aiLabelSimpleColor,
    aiLabelVisual,
    aiLabelOpacity,
    aiLabelPlacement,
    aiLabelHeight,
    aiLabelOffsetX,
    aiLabelOffsetY,
    ...options
  } = flags
  const aiLabelOptions = omitUndefinedProperties({
    mode: aiLabelMode,
    simpleColor: aiLabelSimpleColor,
    visual: aiLabelVisual,
    opacity: aiLabelOpacity,
    placement: aiLabelPlacement,
    height: aiLabelHeight,
    offsetX: aiLabelOffsetX,
    offsetY: aiLabelOffsetY,
  })

  return {
    ...omitUndefinedProperties(options),
    ...(Object.keys(aiLabelOptions).length > 0 ? { aiLabelOptions } : {}),
  }
}

function omitUndefinedProperties<T extends object>(value: T): Partial<{ [K in keyof T]: Exclude<T[K], undefined> }> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<{
    [K in keyof T]: Exclude<T[K], undefined>
  }>
}
