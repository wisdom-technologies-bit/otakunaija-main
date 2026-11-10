import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The cron/claim mechanics. `sql` is replaced by a recorder so the tests can
 * assert what the queue query, the claim and the result write actually send,
 * and the HTTP layer is a stub.
 */

type Row = Record<string, unknown>

const db = vi.hoisted(() => ({
  queries: [] as { text: string; values: unknown[] }[],
  candidateRows: [] as Row[],
  claimRows: [] as Row[],
  writes: [] as Row[],
  remaining: 0,
}))

vi.mock("@/lib/db", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(" ? ")
    db.queries.push({ text, values })
    if (/SELECT count\(\*\)/i.test(text)) return Promise.resolve([{ remaining: db.remaining }])
    if (/UPDATE series SET logo_checked_at = now\(\)/i.test(text)) return Promise.resolve(db.claimRows)
    if (/UPDATE series SET/i.test(text)) {
      db.writes.push(values.length ? { text } : { text })
      return Promise.resolve([])
    }
    return Promise.resolve(db.candidateRows)
  },
}))

// Static import: vi.mock calls above are hoisted, so the mocked db is in place.
import { claimSeriesLogo, fillSeriesLogos, remainingLogoWork, selectLogoWork } from "./fill"

const ORIGINAL_ENV = { ...process.env }

/** Every string anywhere in a recorded query, including nested SQL fragments. */
function flatten(value: unknown, out: string[] = [], seen = new Set<unknown>()): string[] {
  if (typeof value === "string") {
    out.push(value)
    return out
  }
  if (!value || typeof value !== "object" || seen.has(value)) return out
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, out, seen)
    return out
  }
  for (const item of Object.values(value as Record<string, unknown>)) flatten(item, out, seen)
  return out
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })
}

const CANDIDATE: Row = {
  id: 5,
  anilist_id: 21,
  title: "One Piece",
  format: "TV",
  tmdb_id: 95479,
  tmdb_media: "tv",
  tmdb_season: null,
  imdb_id: null,
  logo_status: null,
  logo_checked_at: null,
}

beforeEach(() => {
  db.queries = []
  db.candidateRows = []
  db.claimRows = []
  db.writes = []
  db.remaining = 0
  process.env.TMDB_API_KEY = "super-secret-key"
  process.env.ANIVEXA_BASE_URL = "https://anivexa.test"
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
})

describe("selectLogoWork", () => {
  it("asks only for unchecked rows, newest arrivals, and clamps the batch", async () => {
    await selectLogoWork({ batch: 999 })

    const query = db.queries[0]
    expect(query.text).toContain("FROM series")
    // The retry windows are a nested SQL fragment; the live check in the report
    // exercises them against postgres, here we pin the queue shape.
    expect(flatten(query).join(" | ")).toContain("logo_checked_at IS NULL")
    expect(query.text).toContain("ORDER BY (logo_checked_at IS NULL) DESC")
    expect(query.values).toContain(60)
    expect(query.values).toContain(null)
  })

  it("maps a row and keeps an unknown media type out", async () => {
    db.candidateRows = [{ ...CANDIDATE, tmdb_media: "anime" }]
    const rows = await selectLogoWork({ batch: 5 })

    expect(rows).toEqual([
      {
        id: 5,
        anilistId: 21,
        title: "One Piece",
        format: "TV",
        tmdbId: 95479,
        tmdbMedia: null,
        tmdbSeason: null,
        imdbId: null,
        logoStatus: null,
        logoCheckedAt: null,
      },
    ])
  })
})

describe("claimSeriesLogo", () => {
  it("is true when the row was stamped", async () => {
    db.claimRows = [{ id: 5 }]
    const claimed = await claimSeriesLogo({
      id: 5,
      anilistId: 21,
      title: "One Piece",
      format: "TV",
      tmdbId: 95479,
      tmdbMedia: "tv",
      tmdbSeason: null,
      imdbId: null,
      logoStatus: null,
      logoCheckedAt: null,
    })

    expect(claimed).toBe(true)
    expect(db.queries[0].text).toContain("SET logo_checked_at = now()")
    expect(db.queries[0].values).toContain(5)
  })

  it("is false when another run already claimed it", async () => {
    db.claimRows = []
    const claimed = await claimSeriesLogo({
      id: 5,
      anilistId: 21,
      title: "One Piece",
      format: "TV",
      tmdbId: null,
      tmdbMedia: null,
      tmdbSeason: null,
      imdbId: null,
      logoStatus: null,
      logoCheckedAt: null,
    })
    expect(claimed).toBe(false)
  })
})

describe("fillSeriesLogos", () => {
  it("writes nothing in dry mode", async () => {
    db.candidateRows = [CANDIDATE]
    db.remaining = 12

    const stats = await fillSeriesLogos({ dry: true, batch: 20 })

    expect(stats).toMatchObject({ claimed: 1, found: 0, skipped: 0, remaining: 12, dry: true })
    expect(db.writes).toEqual([])
    expect(db.queries.some((q) => /SET logo_checked_at/i.test(q.text))).toBe(false)
  })

  it("stores the picked logo", async () => {
    db.candidateRows = [CANDIDATE]
    db.claimRows = [{ id: 5 }]
    vi.stubGlobal("fetch", async () =>
      jsonResponse({ logos: [{ file_path: "/one-piece.png", iso_639_1: "en", aspect_ratio: 3.4, width: 1200 }] }),
    )

    const stats = await fillSeriesLogos({ batch: 1 })

    expect(stats).toMatchObject({ claimed: 1, found: 1, none: 0, errors: 0, skipped: 0, rateLimited: false })
    // logo_path / ratio / width / status travel as bind values, in order.
    const write = db.queries.find((q) => /UPDATE series SET/i.test(q.text) && /logo_path/i.test(q.text))
    expect(write).toBeTruthy()
    expect(write!.values).toContain("/one-piece.png")
    expect(write!.values).toContain(3.4)
    expect(write!.values).toContain(1200)
    expect(write!.values).toContain("found")
  })

  it("resolves the TMDB id through Anivexa when the row has none", async () => {
    db.candidateRows = [{ ...CANDIDATE, tmdb_id: null }]
    db.claimRows = [{ id: 5 }]
    const urls: string[] = []

    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input)
      urls.push(url)
      if (url.startsWith("https://anivexa.test/map/21")) {
        return jsonResponse({ mappings: { themoviedbId: 95479, imdbId: "tt0388629" }, format: "TV" })
      }
      return jsonResponse({ logos: [{ file_path: "/op.png", iso_639_1: "en", aspect_ratio: 3, width: 900 }] })
    })

    const stats = await fillSeriesLogos({ batch: 1 })

    expect(stats.found).toBe(1)
    expect(urls[0]).toBe("https://anivexa.test/map/21")
    expect(urls[1]).toContain("/tv/95479/images")
  })

  it("marks a series with no TMDB or IMDb id as none", async () => {
    db.candidateRows = [{ ...CANDIDATE, tmdb_id: null }]
    db.claimRows = [{ id: 5 }]
    vi.stubGlobal("fetch", async () => jsonResponse({ mappings: {} }))

    const stats = await fillSeriesLogos({ batch: 1 })

    expect(stats).toMatchObject({ claimed: 1, found: 0, none: 1, errors: 0 })
    const write = db.queries.find((q) => /UPDATE series SET/i.test(q.text) && /logo_status/i.test(q.text))
    expect(write!.values).toContain("none")
  })

  it("stops on a 429 and leaves the row for the stale-claim retry", async () => {
    db.candidateRows = [CANDIDATE, { ...CANDIDATE, id: 6 }]
    db.claimRows = [{ id: 5 }, { id: 6 }]
    vi.stubGlobal("fetch", async () => new Response("", { status: 429, headers: { "retry-after": "30" } }))

    const stats = await fillSeriesLogos({ batch: 2 })

    expect(stats.rateLimited).toBe(true)
    expect(stats.retryAfterMs).toBe(30000)
    expect(stats.claimed).toBe(1)
    expect(stats.skipped).toBe(1)
    const write = db.queries.find((q) => /UPDATE series SET/i.test(q.text) && /logo_path/i.test(q.text))
    // the claimed row is released with no status so it retries in an hour
    expect(write!.values).not.toContain("error")
    expect(write!.values).not.toContain("found")
  })

  it("counts an unreadable TMDB answer as an error without leaking the key", async () => {
    db.candidateRows = [CANDIDATE]
    db.claimRows = [{ id: 5 }]
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      throw new Error(`boom ${String(input)}`)
    })

    const stats = await fillSeriesLogos({ batch: 1 })

    expect(stats).toMatchObject({ claimed: 1, errors: 1, found: 0 })
    const write = db.queries.find((q) => /UPDATE series SET/i.test(q.text) && /logo_status/i.test(q.text))
    expect(write!.values).toContain("error")
    for (const query of db.queries) expect(query.text).not.toContain("super-secret-key")
  })

  it("does nothing without credentials", async () => {
    delete process.env.TMDB_API_KEY
    delete process.env.TMDB_READ_ACCESS_TOKEN
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    db.remaining = 4

    const stats = await fillSeriesLogos({ batch: 5 })

    expect(stats).toMatchObject({ claimed: 0, found: 0, remaining: 4 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(db.writes).toEqual([])
  })

  it("stops when the time budget is spent", async () => {
    db.candidateRows = [CANDIDATE, { ...CANDIDATE, id: 6 }, { ...CANDIDATE, id: 7 }]
    db.claimRows = [{ id: 5 }]
    vi.stubGlobal("fetch", async () => jsonResponse({ logos: [] }))

    const stats = await fillSeriesLogos({ batch: 3, budgetMs: -1 })

    expect(stats.claimed).toBe(0)
    expect(stats.skipped).toBeGreaterThan(0)
  })
})

describe("remainingLogoWork", () => {
  it("reads the count", async () => {
    db.remaining = 17
    expect(await remainingLogoWork()).toBe(17)
  })
})
