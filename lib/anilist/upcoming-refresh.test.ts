import { describe, expect, it, vi } from "vitest"
import { refreshUpcoming, type UpcomingStore } from "./upcoming-store"
import {
  anilistRequest,
  type AiringScheduleRow,
  type RawAiringSchedule,
  type RawMedia,
  type SeriesMatchRow,
  type UpcomingAnimeRow,
} from "./upcoming"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function media(id: number, overrides: Partial<RawMedia> = {}): RawMedia {
  return {
    id,
    title: { romaji: `Romaji ${id}`, english: `Title ${id}`, native: null },
    coverImage: { extraLarge: `https://s4.anilist.co/file/${id}.jpg`, color: "#000" },
    startDate: { year: 2027, month: 1, day: 10 + (id % 10) },
    season: "WINTER",
    seasonYear: 2027,
    format: "TV",
    status: "NOT_YET_RELEASED",
    episodes: 12,
    duration: 24,
    genres: ["Action"],
    studios: { nodes: [{ name: "Studio" }] },
    description: `<p>Description ${id}</p>`,
    popularity: 10_000 + id,
    trailer: { id: "trailer", site: "youtube" },
    source: "MANGA",
    countryOfOrigin: "JP",
    siteUrl: `https://anilist.co/anime/${id}`,
    nextAiringEpisode: null,
    isAdult: false,
    ...overrides,
  }
}

type RequestPlan = {
  upcoming?: RawMedia[][]
  tba?: RawMedia[][]
  releasing?: RawMedia[][]
  schedule?: RawAiringSchedule[][]
}

/**
 * Stand-in for anilistRequest. Picks the right fixture by query shape, tracks
 * which pages were asked for, and reports hasNextPage from the fixture length.
 */
function makeRequest(plan: RequestPlan) {
  const calls: Array<{ kind: string; page: number }> = []

  const request = (async (query: string, variables: Record<string, unknown> = {}) => {
    const page = Number(variables.page ?? 1)
    const kind = query.includes("airingSchedules")
      ? "schedule"
      : query.includes("status: RELEASING")
        ? "releasing"
        : query.includes("startDate_greater")
          ? "upcoming"
          : "tba"

    calls.push({ kind, page })
    const pages = plan[kind as keyof RequestPlan] ?? []
    const hasNextPage = page < pages.length

    if (kind === "schedule") {
      const pageData = pages[page - 1] ?? []
      return {
        ok: true as const,
        data: { Page: { pageInfo: { hasNextPage }, airingSchedules: pageData } },
      }
    }

    const pageData = pages[page - 1] ?? []
    return { ok: true as const, data: { Page: { pageInfo: { hasNextPage }, media: pageData } } }
  }) as unknown as typeof anilistRequest

  return { request, calls }
}

type MemoryStore = UpcomingStore & {
  media: Map<number, UpcomingAnimeRow>
  schedule: Map<string, AiringScheduleRow>
  writes: number
  prunes: number
}

function memoryStore(
  seriesRows: SeriesMatchRow[] = [{ id: 3, slug: "title-1", title: "Title 1", anilistId: null }],
): MemoryStore {
  const media = new Map<number, UpcomingAnimeRow>()
  const schedule = new Map<string, AiringScheduleRow>()

  return {
    media,
    schedule,
    writes: 0,
    prunes: 0,
    async upsertMedia(rows) {
      this.writes += 1
      for (const row of rows) media.set(row.anilistId, row)
      return rows.length
    },
    async upsertSchedule(rows) {
      this.writes += 1
      for (const row of rows) schedule.set(`${row.anilistId}:${row.episode}`, row)
      return rows.length
    },
    async prune() {
      this.prunes += 1
      return { removedSchedule: 0, removedMedia: 0 }
    },
    async listSeries() {
      return seriesRows
    },
    async lastUpdatedAt() {
      return null
    },
  }
}

const now = new Date("2026-11-09T09:00:00Z")

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("refreshUpcoming", () => {
  it("normalises every query and reports counts", async () => {
    const { request } = makeRequest({
      upcoming: [[media(1), media(2)]],
      tba: [[media(3, { startDate: { year: null, month: null, day: null }, popularity: 9_000 })]],
      releasing: [[media(4, { status: "RELEASING", nextAiringEpisode: { airingAt: 1_763_000_000, episode: 5 } })]],
      schedule: [
        [
          { episode: 5, airingAt: 1_763_000_000, media: media(4, { status: "RELEASING" }) },
          { episode: 1, airingAt: 1_763_100_000, media: media(9, { isAdult: true }) },
        ],
      ],
    })

    const store = memoryStore()
    const result = await refreshUpcoming({ request, store, now })

    expect(result).toMatchObject({
      dry: false,
      written: true,
      rateLimited: false,
      errors: [],
      onSite: 1,
    })
    expect(result.fetched).toBe(4) // 1, 2, 3 (TBA), 4 (releasing)
    expect(result.upserted).toBe(4)
    expect(result.schedule).toBe(1) // the adult schedule row is dropped
    expect(store.media.has(9)).toBe(false)
    expect(store.schedule.size).toBe(1)
    expect(store.prunes).toBe(1)
  })

  it("dry=1 fetches and normalises but writes nothing", async () => {
    const { request } = makeRequest({ upcoming: [[media(1), media(2)]] })
    const store = memoryStore()

    const result = await refreshUpcoming({ request, store, now, dry: true })

    expect(result).toMatchObject({ dry: true, written: false, upserted: 2, schedule: 0 })
    expect(store.writes).toBe(0)
    expect(store.prunes).toBe(0)
    expect(store.media.size).toBe(0)
    expect(store.schedule.size).toBe(0)
  })

  it("is idempotent: a second run rewrites the same rows without duplicating", async () => {
    const plan = {
      upcoming: [[media(1), media(2)]],
      schedule: [[{ episode: 3, airingAt: 1_763_000_000, media: media(2) }]],
    }

    const store = memoryStore()

    const first = await refreshUpcoming({ request: makeRequest(plan).request, store, now })
    const second = await refreshUpcoming({ request: makeRequest(plan).request, store, now })

    expect(second.upserted).toBe(first.upserted)
    expect(second.schedule).toBe(first.schedule)
    expect(store.media.size).toBe(2)
    expect(store.schedule.size).toBe(1)
    expect(second.errors).toEqual([])
  })

  it("drops TBA titles under the popularity floor", async () => {
    const { request } = makeRequest({
      tba: [
        [
          media(10, { startDate: { year: null }, popularity: 50 }),
          media(11, { startDate: { year: 2027, month: 5 }, popularity: 50_000 }),
          media(12, { startDate: { year: null }, popularity: 50_000 }),
        ],
      ],
    })
    const store = memoryStore()

    const result = await refreshUpcoming({ request, store, now })
    expect(result.fetched).toBe(1)
    expect(store.media.has(12)).toBe(true)
    expect(store.media.has(10)).toBe(false)
    // Dated titles are not TBA, so they never enter through this query.
    expect(store.media.has(11)).toBe(false)
  })

  it("respects the page cap", async () => {
    const pages = [
      [media(1)],
      [media(2)],
      [media(3)],
    ]
    const { request, calls } = makeRequest({ upcoming: pages })
    const store = memoryStore()

    await refreshUpcoming({ request, store, now, limit: 1 })

    const upcomingCalls = calls.filter((call) => call.kind === "upcoming")
    expect(upcomingCalls).toHaveLength(1)
  })

  it("stops early once the deadline has passed", async () => {
    const { request, calls } = makeRequest({
      upcoming: [[media(1)], [media(2)]],
      tba: [[media(3)]],
      releasing: [[media(4)]],
      schedule: [[{ episode: 1, airingAt: 1_763_000_000, media: media(4) }]],
    })
    const store = memoryStore()

    const result = await refreshUpcoming({ request, store, now, deadlineMs: -1 })

    expect(result.errors.some((error) => error.includes("deadline reached"))).toBe(true)
    // Page 1 of each query still ran; no page 2 anywhere.
    expect(calls.filter((call) => call.page > 1)).toHaveLength(0)
  })

  it("surfaces rate limiting and never throws", async () => {
    const request = (async () => ({
      ok: false as const,
      reason: "rate_limited" as const,
      status: 429,
    })) as unknown as typeof anilistRequest
    const store = memoryStore()

    const result = await refreshUpcoming({ request, store, now, dry: true })

    expect(result.rateLimited).toBe(true)
    expect(result.fetched).toBe(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain("rate_limited")
    expect(store.writes).toBe(0)
  })

  it("counts on-site matches by anilist id and by normalised title", async () => {
    const { request } = makeRequest({
      upcoming: [
        [
          media(1, { title: { english: "Some Other Name" } }),
          media(2, { title: { english: "One Piece" } }),
          media(3, { title: { english: "Nothing Here" } }),
        ],
      ],
    })
    const store = memoryStore([
      { id: 5, slug: "by-id", title: "Unrelated", anilistId: 1 },
      { id: 6, slug: "one-piece", title: "One Piece", anilistId: null },
    ])

    const result = await refreshUpcoming({ request, store, now, dry: true })
    expect(result.onSite).toBe(2)
  })

  it("records a write failure instead of throwing", async () => {
    const { request } = makeRequest({ upcoming: [[media(1)]] })
    const store = memoryStore()
    store.upsertMedia = vi.fn(async () => {
      throw new Error("neon went away")
    })

    const result = await refreshUpcoming({ request, store, now })
    expect(result.written).toBe(false)
    expect(result.errors.join(" ")).toContain("neon went away")
  })
})
