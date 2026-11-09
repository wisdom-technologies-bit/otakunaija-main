import { describe, expect, it } from "vitest"
import {
  buildUpcomingHref,
  clearUpcomingFilters,
  collectGenres,
  filterUpcoming,
  hasUpcomingFilters,
  paginateUpcoming,
  parseUpcomingParams,
  removeUpcomingFilter,
  upcomingFilterChips,
  type UpcomingParams,
} from "./upcoming-url"

function params(over: Partial<UpcomingParams> = {}): UpcomingParams {
  return {
    view: "week",
    format: "all",
    genre: "",
    sort: "soonest",
    onSite: false,
    page: 1,
    ...over,
  }
}

function item(over: Partial<{
  title: string
  format: string | null
  genres: string[]
  onSite: boolean
  startDateIso: string | null
  startYear: number | null
  startMonth: number | null
  startDay: number | null
  popularity: number | null
}> = {}) {
  return {
    title: "Show",
    format: "TV",
    genres: ["Action"],
    onSite: false,
    startDateIso: "2027-01-10",
    startYear: 2027,
    startMonth: 1,
    startDay: 10,
    popularity: 100,
    ...over,
  }
}

describe("parseUpcomingParams", () => {
  it("falls back to the defaults for junk values", () => {
    expect(parseUpcomingParams({})).toEqual(params())
    expect(parseUpcomingParams({ view: "nope", format: "9", sort: "x", page: "-4" })).toEqual(params())
    expect(parseUpcomingParams({ view: ["later"], page: "3" })).toMatchObject({ view: "later", page: 3 })
    expect(parseUpcomingParams({ onSite: "1" }).onSite).toBe(true)
  })
})

describe("buildUpcomingHref", () => {
  it("resets paging when a filter changes but keeps the tab", () => {
    const href = buildUpcomingHref(params({ view: "season", genre: "Action", page: 4 }), { format: "MOVIE" })
    expect(href).toBe("/episodes/upcoming?view=season&format=MOVIE&genre=Action")
  })

  it("preserves every active param when only the page changes", () => {
    const href = buildUpcomingHref(
      params({ view: "later", format: "ONA", genre: "Romance", sort: "popular", onSite: true, page: 2 }),
      { page: 3 },
    )
    expect(href).toBe(
      "/episodes/upcoming?view=later&format=ONA&genre=Romance&sort=popular&onSite=1&page=3",
    )
  })

  it("omits defaults and drops back to the bare path", () => {
    expect(buildUpcomingHref(params(), {})).toBe("/episodes/upcoming")
    expect(buildUpcomingHref(params({ view: "movies" }), { view: "week" })).toBe("/episodes/upcoming")
  })

  it("keeps the tab when a filter is removed", () => {
    expect(removeUpcomingFilter(params({ view: "season", format: "TV" }), "format")).toBe(
      "/episodes/upcoming?view=season",
    )
    expect(removeUpcomingFilter(params({ view: "movies", onSite: true }), "onSite")).toBe(
      "/episodes/upcoming?view=movies",
    )
  })
})

describe("chips and clear all", () => {
  it("lists removable filters without the tab", () => {
    expect(upcomingFilterChips(params())).toEqual([])
    expect(upcomingFilterChips(params({ view: "season", format: "MOVIE", genre: "Action", sort: "popular", onSite: true }))).toEqual([
      { key: "format", label: "Movie" },
      { key: "genre", label: "Action" },
      { key: "sort", label: "Most popular" },
      { key: "onSite", label: "On OtakuNaija only" },
    ])
    expect(hasUpcomingFilters(params({ view: "later" }))).toBe(false)
  })

  it("clear all keeps the tab and resets the rest", () => {
    expect(clearUpcomingFilters(params({ view: "later", format: "TV", genre: "Action", page: 5 }))).toBe(
      "/episodes/upcoming?view=later",
    )
  })
})

describe("filterUpcoming", () => {
  const items = [
    item({ title: "TV soon", startDateIso: "2027-02-01", startYear: 2027, startMonth: 2, startDay: 1 }),
    item({ title: "Short", format: "TV_SHORT", startDateIso: "2027-01-05", startYear: 2027, startMonth: 1, startDay: 5 }),
    item({ title: "Movie", format: "MOVIE", startDateIso: null, startYear: null, startMonth: null, startDay: null }),
    item({ title: "On site", onSite: true, genres: ["Romance"], startDateIso: "2027-01-20", startYear: 2027, startMonth: 1, startDay: 20 }),
  ]

  it("groups TV and TV_SHORT together", () => {
    const titles = filterUpcoming(items, params({ format: "TV" })).map((entry) => entry.title)
    expect(titles).toEqual(["Short", "On site", "TV soon"])
  })

  it("filters by genre, case insensitively", () => {
    expect(filterUpcoming(items, params({ genre: "romance" })).map((entry) => entry.title)).toEqual(["On site"])
  })

  it("filters the on-site toggle", () => {
    expect(filterUpcoming(items, params({ onSite: true })).map((entry) => entry.title)).toEqual(["On site"])
  })

  it("sorts by popularity when asked", () => {
    const byPopularity = filterUpcoming(
      [item({ title: "low", popularity: 1 }), item({ title: "high", popularity: 900 })],
      params({ sort: "popular" }),
    ).map((entry) => entry.title)
    expect(byPopularity).toEqual(["high", "low"])
  })

  it("pushes undated titles to the end for the Soonest sort", () => {
    expect(filterUpcoming(items, params()).map((entry) => entry.title)).toEqual([
      "Short",
      "On site",
      "TV soon",
      "Movie",
    ])
  })

  it("collects genres alphabetically", () => {
    expect(collectGenres(items)).toEqual(["Action", "Romance"])
  })
})

describe("paginateUpcoming", () => {
  const many = Array.from({ length: 53 }, (_, index) => item({ title: `Show ${index + 1}` }))

  it("pages 24 at a time", () => {
    const page1 = paginateUpcoming(many, 1)
    expect(page1.items).toHaveLength(24)
    expect(page1.totalPages).toBe(3)
    expect(page1.page).toBe(1)

    const page3 = paginateUpcoming(many, 3)
    expect(page3.items).toHaveLength(5)
  })

  it("clamps out-of-range pages", () => {
    expect(paginateUpcoming(many, 99).page).toBe(3)
    expect(paginateUpcoming(many, 0).page).toBe(1)
    expect(paginateUpcoming([], 4)).toMatchObject({ page: 1, total: 0, totalPages: 1 })
  })
})
