import path from "node:path"

/**
 * Parse font metadata from filename.
 * Expected format: {family}[-{style}][-{weight}].{ext}
 *
 * Examples:
 *   - Roboto-Regular.ttf → { fontFamily: "Roboto", fontStyle: "normal", fontWeight: 400 }
 *   - OpenSans-BoldItalic.ttf → { fontFamily: "Open Sans", fontStyle: "italic", fontWeight: 700 }
 *   - Inter-Medium.ttf → { fontFamily: "Inter", fontStyle: "normal", fontWeight: 500 }
 *   - Nunito.ttf → { fontFamily: "Nunito", fontStyle: "normal", fontWeight: 400 }
 *   - Lato-Black.ttf → { fontFamily: "Lato", fontStyle: "normal", fontWeight: 900 }
 */
export function parseFontFilename(filename: string): {
  fontFamily: string
  fontStyle: "normal" | "italic"
  fontWeight: number
} {
  const basename = path.basename(filename)
  const extension = path.extname(basename)
  const nameWithoutExt = basename.replace(new RegExp(`\\${extension}$`), "")

  const parts = nameWithoutExt.split("-")

  let fontFamily = ""
  let fontStyle: "normal" | "italic" = "normal"
  let fontWeight = 400

  const weightMap: Record<string, number> = {
    Thin: 100,
    ExtraLight: 200,
    Light: 300,
    Regular: 400,
    Medium: 500,
    SemiBold: 600,
    Bold: 700,
    ExtraBold: 800,
    Black: 900,
  }

  if (parts.length === 1) {
    fontFamily = parts[0] ?? nameWithoutExt
  } else if (parts.length === 2) {
    const first = parts[0] ?? ""
    const second = parts[1] ?? ""

    if (second in weightMap) {
      fontFamily = first
      fontWeight = weightMap[second]!
    } else if (second.match(/^\d{3}$/)) {
      fontFamily = first
      fontWeight = parseInt(second, 10)
    } else if (second === "Italic") {
      fontFamily = first
      fontStyle = "italic"
    } else {
      fontFamily = `${first} ${second}`
    }
  } else {
    const first = parts[0] ?? ""
    let last = parts[parts.length - 1] ?? ""
    const second = parts[1] ?? ""

    if (last === "Italic") {
      fontStyle = "italic"
      parts.pop()
      last = parts[parts.length - 1] ?? ""
    }

    if (last.match(/^\d{3}$/)) {
      fontWeight = parseInt(last, 10)
      parts.pop()
    } else if (last in weightMap) {
      fontWeight = weightMap[last]!
      parts.pop()
    }

    fontFamily = parts.join(" ")
  }

  fontFamily = fontFamily.replace(/([a-z])([A-Z])/g, "$1 $2")

  return { fontFamily, fontStyle, fontWeight }
}