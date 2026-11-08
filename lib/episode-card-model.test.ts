import { describe, expect, it } from "vitest"
import { NEW_EPISODE_WINDOW_HOURS, episodeCardModel, isNewEpisode } from "./episode-card-model"

const HOUR = 60 * 60 * 1000
const now = Date.parse("2026-11-08T12:00:00.000Z")

function episode(overrides: Record<string, unknown> = {}) {
  return {
    slug: "episode-3",
    title: "Episode 3",
    episodeNumber: 3,
    thumbnailUrl: "https://cdn.example.com/ep3.webp",
    durationSeconds: 1440,
    publishedAt: new Date(now - 2 * HOUR).toISOString(),
    ...overrides,
  }
}

describe("episodeCardModel", () => {
  it("links exactly like the existing episode rows", () => {
    const model = episodeCardModel(episode(), { slug: "blue-lock", title: "Blue Lock" }, now)
    expect(model.href).toBe("/episodes/blue-lock/episode-3")
  })

  it("labels the episode number", () => {
    expect(episodeCardModel(episode(), { slug: "s", title: "S" }, now).epLabel).toBe("Ep 3")
  })

  it("shows the New chip inside 24 hours only", () => {
    const fresh = episodeCardModel(episode(), { slug: "s", title: "S" }, now)
    const stale = episodeCardModel(
      episode({ publishedAt: new Date(now - 25 * HOUR).toISOString() }),
      { slug: "s", title: "S" },
      now,
    )
    expect(NEW_EPISODE_WINDOW_HOURS).toBe(24)
    expect(fresh.isNew).toBe(true)
    expect(stale.isNew).toBe(false)
    expect(isNewEpisode(new Date(now - HOUR).toISOString(), now)).toBe(true)
  })

  it("serialises the release time and formats the duration", () => {
    const model = episodeCardModel(episode(), { slug: "s", title: "S" }, now)
    expect(model.publishedAtISO).toBe(new Date(now - 2 * HOUR).toISOString())
    expect(model.durationLabel).toBe("24:00")
    expect(model.seriesTitle).toBe("S")
  })

  it("degrades gracefully without a thumbnail, series or duration", () => {
    const model = episodeCardModel(
      episode({ thumbnailUrl: null, durationSeconds: null, publishedAt: null }),
      null,
      now,
    )
    expect(model.hasThumbnail).toBe(false)
    expect(model.durationLabel).toBeNull()
    expect(model.publishedAtISO).toBeNull()
    expect(model.isNew).toBe(false)
    expect(model.href).toBe("/episodes//episode-3")
  })
})
