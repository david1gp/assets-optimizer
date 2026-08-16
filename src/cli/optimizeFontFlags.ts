export const optimizeFontFlags = {
  processFonts: {
    kind: "boolean",
    optional: true,
    withNegated: true,
    brief: "Process fonts",
  },
  fontOriginalsDir: {
    kind: "parsed",
    optional: true,
    parse: parseString,
    brief: "Font source directory",
    placeholder: "path",
  },
  fontOptimizedDir: {
    kind: "parsed",
    optional: true,
    parse: parseString,
    brief: "Optimized font directory",
    placeholder: "path",
  },
  fontListOutputPath: {
    kind: "parsed",
    optional: true,
    parse: parseString,
    brief: "Font list output path",
    placeholder: "path",
  },
  generateFontList: {
    kind: "boolean",
    optional: true,
    withNegated: true,
    brief: "Generate the font list",
  },
} as const

function parseString(input: string): string {
  return input
}
