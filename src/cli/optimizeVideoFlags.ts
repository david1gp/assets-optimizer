export const optimizeVideoFlags = {
  processVideos: {
    kind: "boolean",
    optional: true,
    withNegated: true,
    brief: "Process videos",
  },
  videoOriginalsDir: {
    kind: "parsed",
    optional: true,
    parse: parseString,
    brief: "Video source directory",
    placeholder: "path",
  },
  videoOptimizedDir: {
    kind: "parsed",
    optional: true,
    parse: parseString,
    brief: "Optimized video directory",
    placeholder: "path",
  },
  videoListOutputPath: {
    kind: "parsed",
    optional: true,
    parse: parseString,
    brief: "Video list output path",
    placeholder: "path",
  },
  generateVideoList: {
    kind: "boolean",
    optional: true,
    withNegated: true,
    brief: "Generate the video list",
  },
  videoPreviewQuality: {
    kind: "parsed",
    optional: true,
    parse: parseVideoPreviewQuality,
    brief: "Video preview quality from 1 to 100",
    placeholder: "integer",
  },
  videoPreviewHashLength: {
    kind: "parsed",
    optional: true,
    parse: parsePositiveInteger,
    brief: "Video preview hash length",
    placeholder: "integer",
  },
} as const

function parseString(input: string): string {
  return input
}

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

function parsePositiveInteger(input: string): number {
  const value = parseFiniteNumber(input)
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError("expected a positive integer")
  }

  return value
}

function parseIntegerInRange(input: string, minimum: number, maximum: number): number {
  const value = parseFiniteNumber(input)
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`expected an integer from ${minimum} to ${maximum}`)
  }

  return value
}

function parseVideoPreviewQuality(input: string): number {
  return parseIntegerInRange(input, 1, 100)
}
