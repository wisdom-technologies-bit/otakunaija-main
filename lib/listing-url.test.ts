import { describe, expect, it } from "vitest"
import {
  activeFilterChips,
  buildHref,
  clearFiltersHref,
  hasActiveFilters,
} from "./listing-url"

describe("buildHref", () => {
  it("resets paging when a filter changes", () => {
    const href = buildHref("/episodes/browse", { status: "ongoing", genre: "Action", page: "3" }, { status: "completed" })
    expect(href).toBe("/episodes/browse?status=completed&genre=Action")
  })

  it("keeps every active parameter when only the page changes", () => {
    const href = buildHref(
      "/episodes/browse",
      { status: "ongoing", genre: "Romance", sort: "title", page: "1" },
      { page: 2 },
    )
    expect(href).toBe("/episodes/browse?status=ongoing&genre=Romance&sort=title&page=2")
  })

  it("drops defaults instead of writing them into the URL", () => {
    expect(buildHref("/episodes/browse", { status: "ongoing" }, { status: "all" })).toBe("/episodes/browse")
    expect(buildHref("/episodes/browse", { sort: "title" }, { sort: "newest" })).toBe("/episodes/browse")
  })

  it("removes a parameter when the patch value is empty", () => {
    expect(buildHref("/episodes/browse", { genre: "Action" }, { genre: undefined })).toBe("/episodes/browse")
    expect(buildHref("/blog", { category: "News", q: "one piece" }, { q: "" })).toBe("/blog?category=News")
  })

  it("resets paging for blog filters too", () => {
    expect(buildHref("/blog", { category: "News", page: "4" }, { category: "Guides" })).toBe("/blog?category=Guides")
  })
})

describe("clear filters", () => {
  it("points back at the bare listing", () => {
    expect(clearFiltersHref("/episodes/browse")).toBe("/episodes/browse")
    expect(hasActiveFilters({ status: "ongoing" })).toBe(true)
    expect(hasActiveFilters({ status: "all", page: "2" })).toBe(false)
    expect(hasActiveFilters({})).toBe(false)
  })
})

describe("activeFilterChips", () => {
  it("lists the removable filters with readable labels", () => {
    const chips = activeFilterChips(
      { status: "ongoing", genre: "Action", sort: "newest", page: "2" },
      { status: "Status", genre: "Genre" },
    )
    expect(chips).toEqual([
      { key: "status", label: "Status", value: "ongoing" },
      { key: "genre", label: "Genre", value: "Action" },
    ])
  })

  it("is empty when nothing is filtered", () => {
    expect(activeFilterChips({ status: "all", sort: "newest" })).toEqual([])
  })
})
