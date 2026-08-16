export const optimizeGeneralImageFlags = {
  general: {
    cwd: {
      kind: "parsed",
      optional: true,
      parse: parseString,
      brief: "Working directory",
      placeholder: "path",
    },
    logLevel: {
      kind: "parsed",
      optional: true,
      parse: parseLogLevel,
      brief: "Logging level from 0 to 3",
      placeholder: "level",
    },
    processImages: {
      kind: "boolean",
      optional: true,
      withNegated: true,
      brief: "Process images",
    },
  },
  image: {
    source: {
      imageOriginalsDir: {
        kind: "parsed",
        optional: true,
        parse: parseString,
        brief: "Image source directory",
        placeholder: "path",
      },
      imageOptimizedDir: {
        kind: "parsed",
        optional: true,
        parse: parseString,
        brief: "Optimized image directory",
        placeholder: "path",
      },
      allowRootImageFiles: {
        kind: "boolean",
        optional: true,
        withNegated: true,
        brief: "Process image files at the source root",
      },
      imageHashLength: {
        kind: "parsed",
        optional: true,
        parse: parsePositiveInteger,
        brief: "Image hash length",
        placeholder: "integer",
      },
      ignoredDirNames: {
        kind: "parsed",
        optional: true,
        parse: parseString,
        variadic: true,
        brief: "Ignored image directory name, repeatable",
        placeholder: "name",
      },
      imageFilterDirs: {
        kind: "parsed",
        optional: true,
        parse: parseString,
        variadic: true,
        brief: "Image source directory filter, repeatable",
        placeholder: "path",
      },
    },
    output: {
      imageTypeImportPath: {
        kind: "parsed",
        optional: true,
        parse: parseString,
        brief: "Image list type import path",
        placeholder: "path",
      },
      imageListOutputPath: {
        kind: "parsed",
        optional: true,
        parse: parseString,
        brief: "Image list output path",
        placeholder: "path",
      },
      generateImageList: {
        kind: "boolean",
        optional: true,
        withNegated: true,
        brief: "Generate the image list",
      },
    },
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

function parseLogLevel(input: string): 0 | 1 | 2 | 3 {
  return parseIntegerInRange(input, 0, 3) as 0 | 1 | 2 | 3
}
