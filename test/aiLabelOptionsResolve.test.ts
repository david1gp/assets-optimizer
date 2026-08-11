import { describe, expect, test } from "bun:test"
import { aiLabelOptionsResolve } from "../src/image/aiLabelOptionsResolve.js"

describe("AI label options", () => {
  test("resolves the default label configuration", () => {
    expect(aiLabelOptionsResolve()).toEqual({
      mode: "simple",
      simpleColor: "black",
      visual: "padding",
      opacity: "opaque",
      placement: "bottom-right",
      height: 50,
      offsetX: 0,
      offsetY: 0,
    })
  })

  test("overrides only configured values", () => {
    expect(
      aiLabelOptionsResolve({
        mode: "adaptive",
        visual: "circle",
        opacity: "50%",
        placement: "top-left",
        height: 72,
        offsetX: 8,
      }),
    ).toEqual({
      mode: "adaptive",
      simpleColor: "black",
      visual: "circle",
      opacity: "50%",
      placement: "top-left",
      height: 72,
      offsetX: 8,
      offsetY: 0,
    })
  })
})
