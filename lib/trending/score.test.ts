import { describe, expect, it } from "vitest"
import { calculateTrendingScore, rankTrending } from "./score"

describe("calculateTrendingScore", () => {
  const now = new Date("2026-09-24T12:00:00.000Z")

  it("does not let lifetime views dominate recent attention", () => {
    const score = calculateTrendingScore(
      {
        recentActivity: 5,
        previousActivity: 5,
        engagement: 1,
        lifetimeViews: 100_000,
        publishedAt: "2026-09-20T12:00:00.000Z",
      },
      { maxRecent: Math.log1p(5), maxMomentum: Math.log1p(5), maxEngagement: 1, maxVelocity: 1, now },
    )

    expect(score.finalScore).toBeGreaterThan(0)
    expect(score.finalScore).toBeLessThan(0.8)
  })

  it("rewards accelerating activity and sudden spikes", () => {
    const score = calculateTrendingScore(
      { recentActivity: 80, previousActivity: 20, engagement: 10, publishedAt: "2026-09-24T08:00:00.000Z" },
      { maxRecent: Math.log1p(80), maxMomentum: Math.log1p(320), maxEngagement: Math.log1p(10), maxVelocity: Math.log1p(80 / 6), now },
    )

    expect(score.growthRate).toBe(4)
    expect(score.momentum).toBeGreaterThan(0.9)
  })

  it("handles zero activity without invalid numbers", () => {
    const score = calculateTrendingScore(
      { recentActivity: 0, previousActivity: 0, engagement: 0, publishedAt: now },
      { maxRecent: 0, maxMomentum: 0, maxEngagement: 0, maxVelocity: 0, now },
    )

    expect(Object.values(score).every(Number.isFinite)).toBe(true)
  })
})

describe("rankTrending", () => {
  it("produces deterministic rankings and favors momentum over stale popularity", () => {
    const items = [
      { id: "stale", recentActivity: 2, previousActivity: 10, engagement: 2, lifetimeViews: 100_000, publishedAt: "2026-09-20T12:00:00.000Z" },
      { id: "surging", recentActivity: 40, previousActivity: 5, engagement: 4, lifetimeViews: 500, publishedAt: "2026-09-23T12:00:00.000Z" },
    ]

    const first = rankTrending(items, 2, new Date("2026-09-24T12:00:00.000Z"))
    const second = rankTrending(items, 2, new Date("2026-09-24T12:00:00.000Z"))

    expect(first.map((item) => item.id)).toEqual(["surging", "stale"])
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id))
  })
})
