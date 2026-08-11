import { describe, expect, test } from "bun:test"
import { aiLabelGeometryResolve } from "../src/image/aiLabelGeometryResolve.js"

const dimensions = { width: 100, height: 80 }
const svg = { width: 2, height: 1 }

describe("AI label geometry", () => {
  test.each([
    ["top-left", 5, 7, 5, 7],
    ["top-right", 5, 7, 55, 7],
    ["bottom-left", 5, 7, 5, 53],
    ["bottom-right", 5, 7, 55, 53],
  ] as const)("places %s with positive edge offsets", (placement, offsetX, offsetY, x, y) => {
    expect(aiLabelGeometryResolve({ placement, height: 20, offsetX, offsetY }, dimensions, svg)).toEqual({
      x,
      y,
      width: 40,
      height: 20,
    })
  })

  test.each([
    ["top-left", -10, -15, 0, 0],
    ["top-right", -10, -15, 60, 0],
    ["bottom-left", -10, -15, 0, 60],
    ["bottom-right", -10, -15, 60, 60],
  ] as const)("keeps %s within bounds with negative offsets", (placement, offsetX, offsetY, x, y) => {
    expect(aiLabelGeometryResolve({ placement, height: 20, offsetX, offsetY }, dimensions, svg)).toMatchObject({ x, y })
  })

  test("clamps offsets at both image boundaries", () => {
    expect(
      aiLabelGeometryResolve({ placement: "bottom-right", height: 20, offsetX: 200, offsetY: 200 }, dimensions, svg),
    ).toMatchObject({ x: 0, y: 0 })
  })

  test("scales down while preserving the SVG aspect ratio on small images", () => {
    expect(
      aiLabelGeometryResolve(
        { placement: "bottom-right", height: 50, offsetX: 0, offsetY: 0 },
        { width: 30, height: 10 },
        svg,
      ),
    ).toEqual({
      x: 10,
      y: 0,
      width: 20,
      height: 10,
    })
  })
})
