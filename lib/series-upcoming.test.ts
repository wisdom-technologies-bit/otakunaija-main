import { describe, expect, it } from "vitest"
import {
  isUpcomingSeries,
  seriesComingLabel,
  seriesStartLabel,
  seriesStatusClass,
  seriesStatusLabel,
  seriesTrailerUrl,
  upcomingEpisodeCount,
} from "./series-upcoming"

describe("series status presentation", () => {
  it("keeps the existing upcoming chip class", () => {
    expect(seriesStatusClass("upcoming")).toBe("otk-chip-status-upcoming")
    expect(seriesStatusClass("ongoing")).toBe("otk-chip-status-ongoing")
    expect(seriesStatusClass("completed")).toBe("otk-chip-status-completed")
    expect(seriesStatusClass(null)).toBe("otk-chip-status-ongoing")
  })

  it("labels the three statuses", () => {
    expect(seriesStatusLabel("upcoming")).toBe("Upcoming")
    expect(seriesStatusLabel("ongoing")).toBe("Ongoing")
    expect(seriesStatusLabel("completed")).toBe("Completed")
  })

  it("spots an upcoming series", () => {
    expect(isUpcomingSeries({ status: "upcoming" })).toBe(true)
    expect(isUpcomingSeries({ status: "ongoing" })).toBe(false)
    expect(isUpcomingSeries(null)).toBe(false)
  })
})

describe("seriesStartLabel", () => {
  it("uses the full date when AniList knows it", () => {
    expect(seriesStartLabel({ startDate: "2027-01-11" })).toBe("Jan 11, 2027")
    expect(seriesStartLabel({ startDate: new Date("2027-03-04T00:00:00Z") })).toBe("Mar 4, 2027")
  })

  it("falls back to month + year, then year, then TBA", () => {
    expect(seriesStartLabel({ startMonth: 4, startYear: 2027 })).toBe("Apr 2027")
    expect(seriesStartLabel({ startYear: 2027 })).toBe("2027")
    expect(seriesStartLabel({})).toBe("TBA")
    expect(seriesStartLabel(null)).toBe("TBA")
    expect(seriesStartLabel({ startMonth: 13, startYear: 2027 })).toBe("2027")
  })

  it("never invents a day", () => {
    expect(seriesStartLabel({ startDate: "2027-01", startMonth: 1, startYear: 2027 })).toBe("Jan 2027")
  })
})

describe("seriesComingLabel", () => {
  it("reads as a sentence", () => {
    expect(seriesComingLabel({ startDate: "2027-01-11" })).toBe("Coming Jan 11, 2027")
    expect(seriesComingLabel({})).toBe("Coming TBA")
  })
})

describe("seriesTrailerUrl", () => {
  it("builds YouTube and Dailymotion links", () => {
    expect(seriesTrailerUrl({ trailerSite: "youtube", trailerId: "abc123" })).toBe(
      "https://www.youtube.com/watch?v=abc123",
    )
    expect(seriesTrailerUrl({ trailerSite: "dailymotion", trailerId: "x9" })).toBe(
      "https://www.dailymotion.com/video/x9",
    )
  })

  it("returns null for an unknown site or missing id", () => {
    expect(seriesTrailerUrl({ trailerSite: "vimeo", trailerId: "1" })).toBeNull()
    expect(seriesTrailerUrl({ trailerSite: "youtube" })).toBeNull()
    expect(seriesTrailerUrl(null)).toBeNull()
  })
})

describe("upcomingEpisodeCount", () => {
  it("only counts a real positive number", () => {
    expect(upcomingEpisodeCount({ episodesTotal: 12 })).toBe(12)
    expect(upcomingEpisodeCount({ episodesTotal: 0 })).toBeNull()
    expect(upcomingEpisodeCount({})).toBeNull()
  })
})
