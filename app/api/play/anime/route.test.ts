import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Route-level behaviour of the play ingest.
 *
 * The database is replaced by a scripted stand-in: each `select` answers from a
 * queue, and inserts/updates are recorded. That keeps the test about the
 * decisions the route makes (which columns, which status, whether a push fires)
 * without a live Neon branch.
 */

type Row = Record<string, unknown>
type SelectResult = Row[]

const state = vi.hoisted(() => ({
  selects: [] as SelectResult[],
  inserted: [] as { values: Row }[],
  updates: [] as Row[],
  insertedRow: { id: 55 },
}))

function nextSelect(): SelectResult {
  return state.selects.length ? (state.selects.shift() as SelectResult) : []
}

vi.mock("@/lib/db/index", () => {
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => nextSelect(),
        }),
      }),
    }),
    insert: () => ({
      values: (values: Row) => ({
        returning: async () => {
          state.inserted.push({ values })
          return [state.insertedRow]
        },
      }),
    }),
    update: () => ({
      set: (values: Row) => ({
        where: async () => {
          state.updates.push(values)
          return []
        },
      }),
    }),
  }
  return { db }
})

const pushEvents = vi.hoisted(() => [] as string[])
vi.mock("@/lib/push", () => ({
  enqueuePushEvent: async (type: string, id: number) => {
    pushEvents.push(`${type}:${id}`)
  },
}))

// Static import: the vi.mock calls above are hoisted, so stubs apply.
import { POST } from "./route"

const PAYLOAD = {
  anilistId: 21,
  title: "One Piece",
  status: "upcoming",
  description: "Pirates.",
  bannerUrl: "https://img/banner.jpg",
  posterUrl: "https://img/poster.jpg",
  genres: ["Action"],
  studioName: "Toei Animation",
  format: "TV",
  startDate: "2027-01-11",
  startYear: 2027,
  season: "WINTER",
  seasonYear: 2027,
  popularity: 900,
  trailerSite: "youtube",
  trailerId: "abc123",
  episodesTotal: 12,
  durationMinutes: 24,
  source: "MANGA",
  isPlaceholder: true,
}

function request(body: unknown, key = "test-key") {
  return new Request("http://localhost/api/play/anime", {
    method: "POST",
    headers: key ? { "content-type": "application/json", "x-play-api-key": key } : { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  state.selects = []
  state.inserted = []
  state.updates = []
  pushEvents.length = 0
  process.env.PLAY_API_KEY = "test-key"
})

describe("POST /api/play/anime", () => {
  it("rejects a request without the play key", async () => {
    const response = await POST(request(PAYLOAD, ""))
    expect(response.status).toBe(401)
  })

  it("rejects a body without an anilistId or title", async () => {
    const response = await POST(request({ title: "x" }))
    expect(response.status).toBe(400)
  })

  it("creates a new upcoming series with the new columns and no push", async () => {
    // anilist lookup, title lookup, creator lookup, slug lookup
    state.selects = [[], [], [{ id: 7 }], []]

    const response = await POST(request(PAYLOAD))
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json).toEqual({ seriesId: 55, created: true, updated: false })

    const values = state.inserted[0].values
    expect(values).toMatchObject({
      anilistId: 21,
      status: "upcoming",
      isPlaceholder: true,
      format: "TV",
      startDate: "2027-01-11",
      startMonth: 1,
      startYear: 2027,
      season: "WINTER",
      seasonYear: 2027,
      popularity: 900,
      trailerSite: "youtube",
      trailerId: "abc123",
      episodesTotal: 12,
      durationMinutes: 24,
      source: "MANGA",
    })
    // A placeholder must never be announced as new content.
    expect(pushEvents).toEqual([])
  })

  it("enqueues one push event when a new series is already airing", async () => {
    state.selects = [[], [], [{ id: 7 }], []]

    await POST(request({ ...PAYLOAD, status: "RELEASING", isPlaceholder: false }))

    expect(pushEvents).toEqual(["series:55"])
  })

  it("updates an existing series without overwriting a checked title", async () => {
    state.selects = [[{ id: 12, status: "upcoming", titleChecked: true, isPlaceholder: true }]]

    const response = await POST(request({ ...PAYLOAD, title: "One Piece (AniList)" }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ seriesId: 12, created: false, updated: true })
    expect(state.inserted).toEqual([])
    expect(state.updates).toHaveLength(1)
    expect(state.updates[0].title).toBeUndefined()
    expect(state.updates[0]).toMatchObject({
      synopsis: "Pirates.",
      format: "TV",
      popularity: 900,
      trailerId: "abc123",
    })
    // still upcoming: no status write, no push
    expect(state.updates[0].status).toBeUndefined()
    expect(pushEvents).toEqual([])
  })

  it("promotes an existing upcoming series to ongoing and pushes once", async () => {
    state.selects = [[{ id: 12, status: "upcoming", titleChecked: true, isPlaceholder: true }]]

    const response = await POST(request({ ...PAYLOAD, status: "RELEASING", isPlaceholder: false }))
    const json = await response.json()

    expect(json).toEqual({ seriesId: 12, created: false, updated: true })
    expect(state.updates[0]).toMatchObject({ status: "ongoing", isPlaceholder: false })
    expect(pushEvents).toEqual(["series:12"])
  })

  it("refuses to move an ongoing series back to upcoming", async () => {
    state.selects = [[{ id: 12, status: "ongoing", titleChecked: true, isPlaceholder: false }]]

    await POST(request({ ...PAYLOAD, status: "upcoming", isPlaceholder: true }))

    expect(state.updates[0].status).toBeUndefined()
    expect(state.updates[0].isPlaceholder).toBeUndefined()
    expect(pushEvents).toEqual([])
  })

  it("moves an ongoing series to completed without a push", async () => {
    state.selects = [[{ id: 12, status: "ongoing", titleChecked: true, isPlaceholder: false }]]

    await POST(request({ ...PAYLOAD, status: "FINISHED", isPlaceholder: false }))

    expect(state.updates[0].status).toBe("completed")
    expect(pushEvents).toEqual([])
  })
})
