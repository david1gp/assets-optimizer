import type { ApplicationContext } from "@stricli/core"
import { buildCommand } from "@stricli/core"
import { assetsOptimizeOptionsValidate } from "../assetsOptimizeOptionsValidate.js"
import { optimizeAiLabelFlags } from "./optimizeAiLabelFlags.js"
import { optimizeEnvelopeWrite } from "./optimizeEnvelopeWrite.js"
import { optimizeErrorDescribe } from "./optimizeErrorDescribe.js"
import { optimizeExecute } from "./optimizeExecute.js"
import { optimizeFontFlags } from "./optimizeFontFlags.js"
import { optimizeGeneralImageFlags } from "./optimizeGeneralImageFlags.js"
import { optimizeOptionsCreateFromFlags } from "./optimizeOptionsCreateFromFlags.js"
import { optimizeVideoFlags } from "./optimizeVideoFlags.js"

export const optimizeCommand = buildCommand<
  Parameters<typeof optimizeOptionsCreateFromFlags>[0],
  [],
  ApplicationContext
>({
  parameters: {
    flags: {
      ...optimizeGeneralImageFlags.general,
      ...optimizeGeneralImageFlags.image.source,
      ...optimizeAiLabelFlags,
      ...optimizeGeneralImageFlags.image.output,
      ...optimizeVideoFlags,
      ...optimizeFontFlags,
    },
  },
  docs: {
    brief: "Optimize project assets",
  },
  func: async function (flags) {
    const diagnostics: string[] = []

    try {
      const parsedOptions = assetsOptimizeOptionsValidate(optimizeOptionsCreateFromFlags(flags))
      const result = await optimizeExecute(parsedOptions, diagnostics)
      optimizeEnvelopeWrite(this, { success: true, data: result }, diagnostics)
    } catch (error) {
      this.process.exitCode = 1
      optimizeEnvelopeWrite(this, { success: false, error: optimizeErrorDescribe(error) }, diagnostics)
    }
  },
})
