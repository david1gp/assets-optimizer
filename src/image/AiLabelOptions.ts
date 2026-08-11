export interface AiLabelOptions {
  mode?: "simple" | "adaptive"
  simpleColor?: "black" | "white"
  visual?: "padding" | "circle"
  opacity?: "opaque" | "50%"
  placement?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  height?: number
  offsetX?: number
  offsetY?: number
}
