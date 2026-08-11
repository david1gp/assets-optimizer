import sharp from "sharp"

type AiLabelColor = "black" | "white"

type TargetRectangle = {
  x: number
  y: number
  width: number
  height: number
}

export async function aiLabelColorResolve(destinationBuffer: Buffer, target: TargetRectangle): Promise<AiLabelColor> {
  const { data, info } = await sharp(destinationBuffer, { animated: false })
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  if (
    ![target.x, target.y, target.width, target.height, info.width, info.height, info.channels].every(Number.isFinite) ||
    target.width <= 0 ||
    target.height <= 0 ||
    info.width <= 0 ||
    info.height <= 0 ||
    info.channels <= 0
  ) {
    return "black"
  }

  const targetLeft = clamp(target.x, 0, info.width)
  const targetTop = clamp(target.y, 0, info.height)
  const targetRight = clamp(target.x + target.width, targetLeft, info.width)
  const targetBottom = clamp(target.y + target.height, targetTop, info.height)
  if (targetRight <= targetLeft || targetBottom <= targetTop) {
    return "black"
  }

  let luminanceTotal = 0
  let weightTotal = 0
  for (let y = Math.floor(targetTop); y < Math.ceil(targetBottom); y += 1) {
    for (let x = Math.floor(targetLeft); x < Math.ceil(targetRight); x += 1) {
      const pixelOffset = (y * info.width + x) * info.channels
      const coverage = Math.min(x + 1, targetRight) - Math.max(x, targetLeft)
      const rowCoverage = Math.min(y + 1, targetBottom) - Math.max(y, targetTop)
      const weight = coverage * rowCoverage * getAlpha(data, pixelOffset, info.channels)
      if (weight <= 0) {
        continue
      }

      luminanceTotal += getLuminance(data, pixelOffset, info.channels) * weight
      weightTotal += weight
    }
  }

  if (weightTotal <= 0) {
    return "black"
  }

  const luminance = luminanceTotal / weightTotal
  const blackContrast = luminance
  const whiteContrast = 1 - luminance
  return blackContrast <= whiteContrast ? "black" : "white"
}

function getAlpha(data: Buffer, pixelOffset: number, channels: number): number {
  if (channels !== 2 && channels < 4) {
    return 1
  }

  return (data[pixelOffset + channels - 1] ?? 0) / 255
}

function getLuminance(data: Buffer, pixelOffset: number, channels: number): number {
  const red = toLinear((data[pixelOffset] ?? 0) / 255)
  if (channels < 3) {
    return red
  }

  const green = toLinear((data[pixelOffset + 1] ?? 0) / 255)
  const blue = toLinear((data[pixelOffset + 2] ?? 0) / 255)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function toLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
