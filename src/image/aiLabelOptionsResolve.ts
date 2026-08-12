import type { AiLabelOptions } from "./AiLabelOptions.js"

const defaultAiLabelOptions: Required<AiLabelOptions> = {
  mode: "simple",
  simpleColor: "black",
  visual: "padding",
  opacity: "opaque",
  placement: "bottom-right",
  height: 32,
  offsetX: 0,
  offsetY: 0,
}

export function aiLabelOptionsResolve(options: AiLabelOptions = {}): Required<AiLabelOptions> {
  return {
    mode: options.mode ?? defaultAiLabelOptions.mode,
    simpleColor: options.simpleColor ?? defaultAiLabelOptions.simpleColor,
    visual: options.visual ?? defaultAiLabelOptions.visual,
    opacity: options.opacity ?? defaultAiLabelOptions.opacity,
    placement: options.placement ?? defaultAiLabelOptions.placement,
    height: options.height ?? defaultAiLabelOptions.height,
    offsetX: options.offsetX ?? defaultAiLabelOptions.offsetX,
    offsetY: options.offsetY ?? defaultAiLabelOptions.offsetY,
  }
}
