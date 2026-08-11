import type { AiLabelOptions } from "./AiLabelOptions.js"

type Dimensions = {
  width: number
  height: number
}

export function aiLabelGeometryResolve(
  options: Pick<Required<AiLabelOptions>, "placement" | "height" | "offsetX" | "offsetY">,
  image: Dimensions,
  svg: Dimensions,
): { x: number; y: number; width: number; height: number } {
  if (
    ![image.width, image.height, svg.width, svg.height, options.height, options.offsetX, options.offsetY].every(
      Number.isFinite,
    ) ||
    image.width <= 0 ||
    image.height <= 0 ||
    svg.width <= 0 ||
    svg.height <= 0 ||
    options.height <= 0
  ) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const scale = Math.min(options.height / svg.height, image.width / svg.width, image.height / svg.height)
  const width = svg.width * scale
  const height = svg.height * scale
  const right = options.placement.endsWith("right")
  const bottom = options.placement.startsWith("bottom")
  const x = clamp(right ? image.width - width - options.offsetX : options.offsetX, 0, image.width - width)
  const y = clamp(bottom ? image.height - height - options.offsetY : options.offsetY, 0, image.height - height)

  return { x, y, width, height }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
