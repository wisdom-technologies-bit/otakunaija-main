import { describe, expect, it } from "vitest"
import {
  buildCreateValues,
  buildUpdatePatch,
  isUpcomingPayload,
  mapStatus,
  nextSeriesStatus,
  parseStartDate,
  shouldEnqueuePush,
} from "./play-anime"

const basePayload = {
  anilistId: 21,
  title: "One Piece",
  status: "Not Yet Released",
  description: "Pirates.",
  bannerUrl: "https://img/banner.jpg",
  posterUrl: "https://img/poster.jpg",
  genres: ["Action", "Adventure"],
  studioName: "Toei Animation",
  format: "TV",
  startDate: "2027-01-11",
  startYear: 2027,
  season: "WINTER",
  seasonYear: 2027,
  popularity: 12345,
  trailerSite: "youtube",
  trailerId: "abc123",
  episodesTotal: 12,
  durationMinutes: 24,
  source: "MANGA",
  isPlaceholder: true,
}

describe("mapStatus", () => {
  it("keeps the legacy mappings", () => {
    expect(mapStatus("RELEASING")).toBe("ongoing")
    expect(mapStatus("Currently Airing")).toBe("ongoing")
    expect(mapStatus("FINISHED")).toBe("completed")
    expect(mapStatus("Finished Airing")).toBe("completed")
    expect(mapStatus(undefined)).toBe("ongoing")
    expect(mapStatus(null)).toBe("ongoing")
  })

  it("no longer flattens not-yet-released titles to ongoing", () => {
    expect(mapStatus("upcoming")).toBe("upcoming")
    expect(mapStatus("UPCOMING")).toBe("upcoming")
    expect(mapStatus("Not Yet Released")).toBe("upcoming")
    expect(mapStatus("NOT_YET_RELEASED")).toBe("upcoming")
    expect(mapStatus("not yet aired")).toBe("upcoming")
  })

  it("treats an isPlaceholder payload as upcoming even without a status", () => {
    expect(isUpcomingPayload({ anilistId: 1, title: "x", isPlaceholder: true })).toBe(true)
    expect(isUpcomingPayload({ anilistId: 1, title: "x", status: "RELEASING" })).toBe(false)
  })
})

describe("nextSeriesStatus", () => {
  it("allows upcoming -> ongoing", () => {
    expect(nextSeriesStatus("upcoming", "ongoing")).toBe("ongoing")
  })

  it("allows ongoing -> completed", () => {
    expect(nextSeriesStatus("ongoing", "completed")).toBe("completed")
  })

  it("refuses to demote a live or finished series to upcoming", () => {
    expect(nextSeriesStatus("ongoing", "upcoming")).toBeNull()
    expect(nextSeriesStatus("completed", "upcoming")).toBeNull()
    expect(nextSeriesStatus("upcoming", "upcoming")).toBeNull()
  })

  it("refuses to reopen a completed series", () => {
    expect(nextSeriesStatus("completed", "ongoing")).toBeNull()
  })
})

describe("parseStartDate", () => {
  it("accepts ISO strings, dates and timestamps", () => {
    expect(parseStartDate("2027-01-11")).toBe("2027-01-11")
    expect(parseStartDate("2027-01-11T12:00:00Z")).toBe("2027-01-11")
    expect(parseStartDate(new Date("2027-01-11T05:00:00Z"))).toBe("2027-01-11")
  })

  it("returns null for junk and empty values", () => {
    expect(parseStartDate(null)).toBeNull()
    expect(parseStartDate("")).toBeNull()
    expect(parseStartDate("TBA")).toBeNull()
    expect(parseStartDate(undefined)).toBeNull()
  })
})

describe("buildCreateValues", () => {
  it("stores the upcoming metadata and the placeholder flag", () => {
    const values = buildCreateValues(basePayload, 7, "one-piece")
    expect(values).toMatchObject({
      creatorId: 7,
      slug: "one-piece",
      anilistId: 21,
      title: "One Piece",
      status: "upcoming",
      isPlaceholder: true,
      genre: "Action, Adventure",
      format: "TV",
      startDate: "2027-01-11",
      startMonth: 1,
      startYear: 2027,
      season: "WINTER",
      seasonYear: 2027,
      popularity: 12345,
      trailerSite: "youtube",
      trailerId: "abc123",
      episodesTotal: 12,
      durationMinutes: 24,
      source: "MANGA",
      coverImageUrl: "https://img/banner.jpg",
      posterImageUrl: "https://img/poster.jpg",
    })
  })

  it("derives the release year from the start date when none was sent", () => {
    const values = buildCreateValues({ ...basePayload, startYear: null }, 7, "x")
    expect(values.startYear).toBe(2027)
  })

  it("does not mark a live series as a placeholder when the flag is absent", () => {
    const values = buildCreateValues({ anilistId: 5, title: "Live", status: "RELEASING" }, 7, "live")
    expect(values.status).toBe("ongoing")
    expect(values.isPlaceholder).toBe(false)
  })
})

describe("buildUpdatePatch", () => {
  it("refreshes metadata but never overwrites a checked title", () => {
    const { patch, statusChanged } = buildUpdatePatch(
      { status: "upcoming", titleChecked: true, isPlaceholder: true },
      { ...basePayload, title: "One Piece (AniList spelling)" },
    )

    expect(patch.title).toBeUndefined()
    expect(patch.synopsis).toBe("Pirates.")
    expect(patch.posterImageUrl).toBe("https://img/poster.jpg")
    expect(patch.format).toBe("TV")
    expect(patch.startDate).toBe("2027-01-11")
    expect(patch.popularity).toBe(12345)
    expect(patch.trailerId).toBe("abc123")
    // Incoming status is still upcoming: no transition.
    expect(statusChanged).toBe(false)
    expect(patch.status).toBeUndefined()
    expect(patch.isPlaceholder).toBeUndefined()
  })

  it("refreshes the title while it has not been checked", () => {
    const { patch } = buildUpdatePatch(
      { status: "upcoming", titleChecked: false, isPlaceholder: true },
      { ...basePayload, title: "One Piece" },
    )
    expect(patch.title).toBe("One Piece")
  })

  it("promotes upcoming -> ongoing and clears the placeholder", () => {
    const { patch, statusChanged, becameOngoing } = buildUpdatePatch(
      { status: "upcoming", titleChecked: true, isPlaceholder: true },
      { ...basePayload, status: "RELEASING", isPlaceholder: false },
    )
    expect(statusChanged).toBe(true)
    expect(becameOngoing).toBe(true)
    expect(patch.status).toBe("ongoing")
    expect(patch.isPlaceholder).toBe(false)
  })

  it("moves ongoing -> completed", () => {
    const { patch, becameOngoing } = buildUpdatePatch(
      { status: "ongoing", titleChecked: true, isPlaceholder: false },
      { ...basePayload, status: "FINISHED" },
    )
    expect(patch.status).toBe("completed")
    expect(becameOngoing).toBe(false)
  })

  it("refuses ongoing -> upcoming", () => {
    const { patch, statusChanged } = buildUpdatePatch(
      { status: "ongoing", titleChecked: true, isPlaceholder: false },
      { ...basePayload, status: "upcoming", isPlaceholder: true },
    )
    expect(statusChanged).toBe(false)
    expect(patch.status).toBeUndefined()
    expect(patch.isPlaceholder).toBeUndefined()
  })

  it("does not wipe stored values with nulls", () => {
    const { patch } = buildUpdatePatch(
      { status: "upcoming", titleChecked: true, isPlaceholder: true },
      { anilistId: 21, title: "One Piece", status: "upcoming", description: null, posterUrl: null, popularity: null },
    )
    expect(patch.synopsis).toBeUndefined()
    expect(patch.posterImageUrl).toBeUndefined()
    expect(patch.popularity).toBeUndefined()
  })
})

describe("shouldEnqueuePush", () => {
  it("never announces a placeholder", () => {
    expect(shouldEnqueuePush("upcoming", true)).toBe(false)
    expect(shouldEnqueuePush("upcoming", false)).toBe(false)
  })

  it("announces a series that is actually airing", () => {
    expect(shouldEnqueuePush("ongoing", false)).toBe(true)
  })
})
