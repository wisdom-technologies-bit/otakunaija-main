import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The first episode must promote an upcoming series in the same transaction as
 * the insert. The database is a scripted stand-in (selects answer from a queue,
 * writes are recorded) so the test is about that decision, not about Neon.
 */

type Row = Record<string, unknown>

const state = vi.hoisted(() => ({
  selects: [] as Row[][],
  seriesUpdates: [] as Row[],
  episodeUpdates: [] as Row[],
  transactions: 0,
  insertedEpisode: { id: 99 },
}))

function nextSelect(): Row[] {
  return state.selects.length ? (state.selects.shift() as Row[]) : []
}

vi.mock("@/lib/db/index", () => {
  const tx = {
    insert: () => ({
      values: () => ({
        returning: async () => [state.insertedEpisode],
      }),
    }),
    update: () => ({
      set: (values: Row) => ({
        where: async () => {
          state.seriesUpdates.push(values)
          return []
        },
      }),
    }),
  }

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => nextSelect(),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: async () => [state.insertedEpisode],
      }),
    }),
    update: () => ({
      set: (values: Row) => ({
        where: () => ({
          returning: async () => {
            state.episodeUpdates.push(values)
            return [{ id: 3 }]
          },
        }),
      }),
    }),
    transaction: async (fn: (client: typeof tx) => Promise<unknown>) => {
      state.transactions += 1
      return fn(tx)
    },
  }

  return { db }
})

// The route pulls in modules marked `server-only`; vitest has no such package.
vi.mock("server-only", () => ({}))

// Static import: the vi.mock calls above are hoisted, so stubs apply.
import { POST } from "./route"

function request(body: unknown) {
  return new Request("http://localhost/api/play/episodes", {
    method: "POST",
    headers: { "content-type": "application/json", "x-play-api-key": "test-key" },
    body: JSON.stringify(body),
  })
}

const PAYLOAD = {
  anilistId: 21,
  episodeNumber: 1,
  playId: "play-abc",
  title: "I'm Luffy!",
  description: "The beginning.",
  duration: 24,
}

beforeEach(() => {
  state.selects = []
  state.seriesUpdates = []
  state.episodeUpdates = []
  state.transactions = 0
  process.env.PLAY_API_KEY = "test-key"
})

describe("POST /api/play/episodes", () => {
  it("flips an upcoming series to ongoing in the same transaction", async () => {
    state.selects = [
      [{ id: 4, anilistId: 21, status: "upcoming", isPlaceholder: true, posterImageUrl: null }],
      [],
      [],
    ]

    const response = await POST(request(PAYLOAD))
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json).toEqual({ episodeId: 99, seriesId: 4 })
    expect(state.transactions).toBe(1)
    expect(state.seriesUpdates).toEqual([{ status: "ongoing", isPlaceholder: false }])
  })

  it("also promotes a placeholder flagged series that still says ongoing", async () => {
    state.selects = [
      [{ id: 4, anilistId: 21, status: "ongoing", isPlaceholder: true, posterImageUrl: null }],
      [],
      [],
    ]

    await POST(request(PAYLOAD))

    expect(state.seriesUpdates).toEqual([{ status: "ongoing", isPlaceholder: false }])
  })

  it("leaves an already-airing series alone", async () => {
    state.selects = [
      [{ id: 4, anilistId: 21, status: "ongoing", isPlaceholder: false, posterImageUrl: null }],
      [],
      [],
    ]

    const response = await POST(request(PAYLOAD))

    expect(response.status).toBe(201)
    expect(state.seriesUpdates).toEqual([])
  })

  it("still updates an existing episode without touching the series", async () => {
    state.selects = [
      [{ id: 4, anilistId: 21, status: "upcoming", isPlaceholder: true, posterImageUrl: null }],
      [{ id: 3 }],
    ]

    const response = await POST(request({ ...PAYLOAD, title: "I'm Luffy! (fixed)" }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ episodeId: 3, seriesId: 4 })
    expect(state.transactions).toBe(0)
    expect(state.episodeUpdates).toHaveLength(1)
    expect(state.seriesUpdates).toEqual([])
  })

  it("404s for an unknown AniList id", async () => {
    state.selects = [[]]
    const response = await POST(request(PAYLOAD))
    expect(response.status).toBe(404)
  })
})
