import * as v from "valibot"
import { type AssetsOptimizeOptions, assetsOptimizeOptionsSchema } from "./AssetsOptimizeOptions.js"

export function assetsOptimizeOptionsValidate(options: unknown): AssetsOptimizeOptions {
  const result = v.safeParse(assetsOptimizeOptionsSchema, options)
  if (!result.success) {
    throw new TypeError(`Invalid assetsOptimize options: ${v.summarize(result.issues)}`)
  }

  return result.output
}
