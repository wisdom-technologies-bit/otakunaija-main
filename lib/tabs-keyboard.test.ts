import { describe, expect, it } from "vitest"
import { nextTabIndex } from "./tabs-keyboard"

describe("nextTabIndex", () => {
  it("moves right and wraps around", () => {
    expect(nextTabIndex(0, 5, "ArrowRight")).toBe(1)
    expect(nextTabIndex(4, 5, "ArrowRight")).toBe(0)
  })

  it("moves left and wraps around", () => {
    expect(nextTabIndex(2, 5, "ArrowLeft")).toBe(1)
    expect(nextTabIndex(0, 5, "ArrowLeft")).toBe(4)
  })

  it("jumps to the ends with Home and End", () => {
    expect(nextTabIndex(3, 5, "Home")).toBe(0)
    expect(nextTabIndex(1, 5, "End")).toBe(4)
  })

  it("ignores unrelated keys so typing and activation still work", () => {
    expect(nextTabIndex(1, 5, "Enter")).toBeNull()
    expect(nextTabIndex(1, 5, " ")).toBeNull()
    expect(nextTabIndex(1, 5, "Tab")).toBeNull()
    expect(nextTabIndex(1, 5, "ArrowDown")).toBeNull()
  })

  it("is safe for an empty or out-of-range tablist", () => {
    expect(nextTabIndex(0, 0, "ArrowRight")).toBeNull()
    expect(nextTabIndex(9, 3, "ArrowRight")).toBe(1)
    expect(nextTabIndex(-1, 3, "ArrowLeft")).toBe(1)
  })
})
