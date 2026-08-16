export const optimizeAiLabelFlags = {
  aiLabelMode: {
    kind: "enum",
    values: ["simple", "adaptive"],
    optional: true,
    brief: "AI label mode",
  },
  aiLabelSimpleColor: {
    kind: "enum",
    values: ["black", "white"],
    optional: true,
    brief: "AI label simple color",
  },
  aiLabelVisual: {
    kind: "enum",
    values: ["padding", "circle"],
    optional: true,
    brief: "AI label visual",
  },
  aiLabelOpacity: {
    kind: "enum",
    values: ["opaque", "50%"],
    optional: true,
    brief: "AI label opacity",
  },
  aiLabelPlacement: {
    kind: "enum",
    values: ["top-left", "top-right", "bottom-left", "bottom-right"],
    optional: true,
    brief: "AI label placement",
  },
  aiLabelHeight: {
    kind: "parsed",
    optional: true,
    parse: parsePositiveNumber,
    brief: "AI label height",
    placeholder: "number",
  },
  aiLabelOffsetX: {
    kind: "parsed",
    optional: true,
    parse: parseFiniteNumber,
    brief: "AI label horizontal offset",
    placeholder: "number",
  },
  aiLabelOffsetY: {
    kind: "parsed",
    optional: true,
    parse: parseFiniteNumber,
    brief: "AI label vertical offset",
    placeholder: "number",
  },
} as const

function parseFiniteNumber(input: string): number {
  if (input.trim() === "") {
    throw new TypeError("expected a finite number")
  }

  const value = Number(input)
  if (!Number.isFinite(value)) {
    throw new TypeError("expected a finite number")
  }

  return value
}

function parsePositiveNumber(input: string): number {
  const value = parseFiniteNumber(input)
  if (value <= 0) {
    throw new TypeError("expected a number greater than 0")
  }

  return value
}
