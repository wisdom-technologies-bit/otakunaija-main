import { describe, expect, it } from "vitest"
import {
  chooseLayout,
  EPISODE_DROP_THRESHOLD,
  LAYOUT_IDS,
  QUIET_CONTENT_THRESHOLD,
  seedFromDate,
  variantFor,
} from "./layout"
import type { IssueContent } from "./types"

function content(overrides: Partial<IssueContent> = {}): IssueContent {
  const base: IssueContent = {
    windowStart: "2026-11-09T00:00:00.000Z",
    windowEnd: "2026-11-09T06:00:00.000Z",
    windowHours: 24,
    topStory: null,
    posts: [],
    seriesGroups: [],
    episodes: [],
    airing: [],
    schedule: [],
    upcoming: [],
    trending: [],
    weekInReview: [],
    counts: { posts: 0, episodes: 0, series: 0, airing: 0, upcoming: 0, trending: 0 },
    meaningfulItems: 0,
    skipped: false,
    skipReason: null,
  }
  return { ...base, ...overrides }
}

/** `meaningful` posts, enough to clear the quiet-day threshold. */
function richContent(episodes = 0): IssueContent {
  return content({
    counts: { posts: 8, episodes, series: episodes ? 4 : 0, airing: 2, upcoming: 0, trending: 3 },
    meaningfulItems: 8 + (episodes ? 4 : 0) + 2,
  })
}

describe("chooseLayout", () => {
  it("picks quiet-day below the content threshold, whatever the weekday", () => {
    for (let weekday = 0; weekday <= 6; weekday += 1) {
      const choice = chooseLayout(content({ meaningfulItems: QUIET_CONTENT_THRESHOLD - 1 }), weekday, 100)
      expect(choice.layout).toBe("quiet-day")
      expect(choice.reason).toContain("quiet-day")
    }
  })

  it("anchors Monday, Friday and Sunday regardless of how much content there is", () => {
    const heavy = richContent(12)
    expect(chooseLayout(heavy, 1, 100).layout).toBe("week-ahead")
    expect(chooseLayout(heavy, 5, 100).layout).toBe("weekend-watch")
    expect(chooseLayout(heavy, 0, 100).layout).toBe("roundup")
  })

  it("uses the poster wall at six or more episodes on other days", () => {
    expect(chooseLayout(richContent(EPISODE_DROP_THRESHOLD), 2, 100).layout).toBe("episode-drop")
    expect(chooseLayout(richContent(EPISODE_DROP_THRESHOLD - 1), 2, 100).layout).toBe("lead-story")
  })

  it("covers every weekday and both content shapes without ever returning nothing", () => {
    for (let weekday = 0; weekday <= 6; weekday += 1) {
      for (const shape of [content({ meaningfulItems: 0 }), richContent(0), richContent(9)]) {
        const choice = chooseLayout(shape, weekday, 8640 + weekday)
        expect(LAYOUT_IDS).toContain(choice.layout)
        expect(choice.reason.length).toBeGreaterThan(0)
      }
    }
  })

  it("is deterministic for the same inputs", () => {
    const shape = richContent(2)
    const first = chooseLayout(shape, 2, 20_654)
    const second = chooseLayout(shape, 2, 20_654)
    expect(second).toEqual(first)
  })
})

describe("variantFor", () => {
  it("is stable for a given seed", () => {
    expect(variantFor(20_654)).toEqual(variantFor(20_654))
  })

  it("never repeats the previous day's whole combination", () => {
    let previous = variantFor(20_000)
    for (let seed = 20_001; seed < 20_120; seed += 1) {
      const current = variantFor(seed)
      const same =
        current.crop === previous.crop &&
        current.divider === previous.divider &&
        current.accent === previous.accent &&
        current.button === previous.button &&
        current.order === previous.order
      expect(same).toBe(false)
      previous = current
    }
  })

  it("changes something across a whole year of consecutive issues", () => {
    const seen = new Set<string>()
    for (let seed = 20_000; seed < 20_365; seed += 1) {
      const variant = variantFor(seed)
      seen.add(`${variant.crop}|${variant.divider}|${variant.accent}|${variant.button}|${variant.order}`)
    }
    // 3*3*3*3*2 = 162 possible combinations; a year should not collapse to a handful.
    expect(seen.size).toBeGreaterThan(40)
  })
})

describe("seedFromDate", () => {
  it("turns an issue date into a stable integer", () => {
    expect(seedFromDate("2026-11-09")).toBe(seedFromDate("2026-11-09"))
    expect(seedFromDate("2026-11-10") - seedFromDate("2026-11-09")).toBe(1)
  })

  it("returns 0 for something that is not a date", () => {
    expect(seedFromDate("not-a-date")).toBe(0)
  })
})
