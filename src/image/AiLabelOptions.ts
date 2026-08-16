import * as v from "valibot"

const finiteNumberSchema = v.pipe(v.number(), v.finite())

export const aiLabelOptionsSchema = v.strictObject({
  mode: v.optional(v.picklist(["simple", "adaptive"])),
  simpleColor: v.optional(v.picklist(["black", "white"])),
  visual: v.optional(v.picklist(["padding", "circle"])),
  opacity: v.optional(v.picklist(["opaque", "50%"])),
  placement: v.optional(v.picklist(["top-left", "top-right", "bottom-left", "bottom-right"])),
  height: v.optional(v.pipe(finiteNumberSchema, v.gtValue(0))),
  offsetX: v.optional(finiteNumberSchema),
  offsetY: v.optional(finiteNumberSchema),
})

export type AiLabelOptions = v.InferOutput<typeof aiLabelOptionsSchema>
