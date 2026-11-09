import { describe, expect, it } from "vitest"
import {
  buildSchedule,
  DEFAULT_WINDOW_HOURS,
  groupEpisodes,
  MAX_SERIES_GROUPS,
  MAX_WINDOW_HOURS,
  MIN_WINDOW_HOURS,
  recentPostIds,
  selectIssueContent,
  selectionWindow,
  usedPostIds,
} from "./select"
import { fixtureSources } from "./fixtures"
import type { RawEpisode, SelectSources } from "./types"

const NOW = new Date("2026-11-09T06:00:00.000Z")
const SITE = "https://otakunaija.name.ng"

function select(sources: SelectSources, options: { now?: Date; lastSentAt?: Date | null; exclude?: number[] } = {}) {
  return selectIssueContent({
    now: options.now ?? NOW,
    lastSentAt: options.lastSentAt === undefined ? new Date(NOW.getTime() - 24 * 3_600_000) : options.lastSentAt,
    sources,
    excludePostIds: options.exclude ?? [],
    siteBaseUrl: SITE,
  })
}

describe("selectionWindow", () => {
  it("defaults to 24 hours when there is no previous issue", () => {
    const window = selectionWindow(NOW, null)
    expect(window.hours).toBe(DEFAULT_WINDOW_HOURS)
    expect(window.start.toISOString()).toBe(new Date(NOW.getTime() - 24 * 3_600_000).toISOString())
  })

  it("clamps a long gap to 36 hours", () => {
    expect(selectionWindow(NOW, new Date(NOW.getTime() - 60 * 3_600_000)).hours).toBe(MAX_WINDOW_HOURS)
  })

  it("clamps a short gap to 18 hours", () => {
    expect(selectionWindow(NOW, new Date(NOW.getTime() - 4 * 3_600_000)).hours).toBe(MIN_WINDOW_HOURS)
  })

  it("uses the real gap when it is inside the range", () => {
    expect(selectionWindow(NOW, new Date(NOW.getTime() - 26 * 3_600_000)).hours).toBe(26)
  })
})

describe("selectIssueContent", () => {
  it("leads with an image-backed story and fills the secondary slots", () => {
    const content = select(fixtureSources(NOW))
    expect(content.topStory).not.toBeNull()
    expect(content.topStory?.imageUrl).toContain("res.cloudinary.com")
    expect(content.posts.length).toBeGreaterThan(0)
    expect(content.posts.length).toBeLessThanOrEqual(5)
    expect(content.skipped).toBe(false)
  })

  it("never repeats a post from the last three issues", () => {
    const content = select(fixtureSources(NOW), { exclude: [101, 102, 103] })
    const usedIds = [content.topStory?.id, ...content.posts.map((post) => post.id)]
    expect(usedIds).not.toContain(101)
    expect(usedIds).not.toContain(102)
    expect(usedIds).not.toContain(103)
  })

  it("drops content outside the window", () => {
    const sources = fixtureSources(NOW)
    // 56 hours old: outside the 24 hour default window.
    const stale = sources.posts.find((post) => post.id === 107)
    expect(stale).toBeDefined()

    const content = select(sources)
    expect(content.posts.some((post) => post.id === 107)).toBe(false)
    expect(content.topStory?.id).not.toBe(107)
  })

  it("excludes adult content from episodes and airing", () => {
    const sources = fixtureSources(NOW)
    const adultEpisode: RawEpisode = {
      ...sources.episodes[0],
      id: 9999,
      seriesId: 999,
      seriesSlug: "adult-series",
      seriesTitle: "Adult Series",
      adult: true,
    }
    sources.episodes = [...sources.episodes, adultEpisode]
    sources.airing = sources.airing.map((row, index) => (index === 0 ? { ...row, adult: true } : row))

    const content = select(sources)
    expect(content.seriesGroups.some((group) => group.title === "Adult Series")).toBe(false)
    expect(content.airing.every((item) => item.title !== sources.airing[0].title)).toBe(true)
  })

  it("caps the poster wall at eight series", () => {
    const groups = groupEpisodes(fixtureSources(NOW).episodes, SITE)
    expect(groups.length).toBeLessThanOrEqual(MAX_SERIES_GROUPS)
    expect(groups[0].episodes.length).toBeGreaterThan(0)
    // Highest episode number first inside a series.
    const numbers = groups[0].episodes.map((episode) => episode.number ?? 0)
    expect(numbers).toEqual(numbers.slice().sort((a, b) => b - a))
  })

  it("skips the issue when there is not enough content", () => {
    const sources = fixtureSources(NOW)
    sources.posts = sources.posts.slice(0, 1)
    sources.episodes = []
    sources.airing = []
    sources.upcoming = []
    sources.trending = []

    const content = select(sources)
    expect(content.skipped).toBe(true)
    expect(content.skipReason).toContain("only-")
  })

  it("skips with a specific reason when there is no post and no episode", () => {
    const sources = fixtureSources(NOW)
    sources.posts = []
    sources.episodes = []

    const content = select(sources)
    expect(content.skipped).toBe(true)
    expect(content.skipReason).toBe("no-new-posts-or-episodes")
  })

  it("sorts airing by popularity and keeps it inside 36 hours", () => {
    const content = select(fixtureSources(NOW))
    expect(content.airing.length).toBeGreaterThan(0)
    expect(content.airing.length).toBeLessThanOrEqual(6)
    const popularity = content.airing.map((item) => item.popularity)
    expect(popularity).toEqual(popularity.slice().sort((a, b) => b - a))
    for (const item of content.airing) {
      const delta = new Date(item.airingAt).getTime() - NOW.getTime()
      expect(delta).toBeLessThanOrEqual(36 * 3_600_000)
    }
  })

  it("only adds season premieres on Mondays and Fridays", () => {
    const monday = select(fixtureSources(new Date("2026-11-09T06:00:00.000Z")), {
      now: new Date("2026-11-09T06:00:00.000Z"),
    })
    const tuesday = select(fixtureSources(new Date("2026-11-10T06:00:00.000Z")), {
      now: new Date("2026-11-10T06:00:00.000Z"),
    })
    expect(monday.upcoming.length).toBeGreaterThan(0)
    expect(tuesday.upcoming.length).toBe(0)
  })

  it("only builds a week in review on Sundays", () => {
    const sunday = select(fixtureSources(new Date("2026-11-15T06:00:00.000Z")), {
      now: new Date("2026-11-15T06:00:00.000Z"),
    })
    const wednesday = select(fixtureSources(new Date("2026-11-11T06:00:00.000Z")), {
      now: new Date("2026-11-11T06:00:00.000Z"),
    })
    expect(sunday.weekInReview.length).toBeGreaterThan(0)
    expect(sunday.weekInReview.length).toBeLessThanOrEqual(5)
    expect(wednesday.weekInReview.length).toBe(0)
  })
})

describe("buildSchedule", () => {
  it("always returns seven Monday-first days", () => {
    const content = select(fixtureSources(NOW))
    const days = buildSchedule(content.airing, NOW)
    expect(days).toHaveLength(7)
    expect(days[0].dayKey).toBe("2026-11-09")
    expect(days[6].dayKey).toBe("2026-11-15")
    expect(days[0].isToday).toBe(true)
  })
})

describe("post id bookkeeping", () => {
  it("collects every post an issue used", () => {
    const content = select(fixtureSources(NOW))
    const ids = usedPostIds(content)
    if (content.topStory) expect(ids).toContain(content.topStory.id)
  })

  it("merges ids from the last three payloads only", () => {
    const ids = recentPostIds([{ postIds: [1] }, { postIds: [2] }, { postIds: [3] }, { postIds: [4] }])
    expect(ids.sort()).toEqual([1, 2, 3])
  })
})
