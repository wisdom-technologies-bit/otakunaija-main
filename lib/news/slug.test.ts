import { describe, expect, it } from "vitest"
import { pickUniqueSlug, slugifyTitle } from "./slug"

describe("slugifyTitle", () => {
  it("builds a clean, lowercase, url-safe slug", () => {
    expect(slugifyTitle("Spy×Family Anime Gets 4th Season, Theatrical Film in 2027")).toBe(
      "spy-family-anime-gets-4th-season-theatrical-film-in-2027",
    )
    expect(slugifyTitle("  Dandadan's   Season 2!! ")).toBe("dandadans-season-2")
  })

  it("strips diacritics instead of dropping the letters", () => {
    expect(slugifyTitle("Kōhaku & Kōsuke")).toBe("kohaku-kosuke")
  })

  it("caps length and never returns an empty slug", () => {
    const long = slugifyTitle("a".repeat(40) + " " + "b".repeat(90))
    expect(long.length).toBeLessThanOrEqual(80)
    expect(long.endsWith("-")).toBe(false)
    expect(slugifyTitle("!!!")).toMatch(/^news-\d+$/)
  })
})

describe("pickUniqueSlug", () => {
  it("uses the base slug when it is free", () => {
    expect(pickUniqueSlug("spy-family-season-4", [])).toBe("spy-family-season-4")
  })

  it("appends the next free counter", () => {
    expect(pickUniqueSlug("spy-family-season-4", ["spy-family-season-4"])).toBe("spy-family-season-4-2")
    expect(pickUniqueSlug("spy-family-season-4", ["spy-family-season-4", "spy-family-season-4-2"])).toBe(
      "spy-family-season-4-3",
    )
  })

  it("ignores unrelated slugs that merely share a prefix", () => {
    expect(pickUniqueSlug("spy-family", ["spy-family-season-4"])).toBe("spy-family")
  })
})
