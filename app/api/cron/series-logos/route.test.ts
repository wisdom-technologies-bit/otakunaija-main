import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { SeriesLogoStats } from "@/lib/tmdb/fill"
import { GET } from "./route"

// The real module builds its retry SQL at import time, which needs a database.
vi.mock("@/lib/db", () => ({ sql: () => Promise.resolve([]) }))

const fillSeriesLogos = vi.fn<(...args: unknown[]) => Promise<SeriesLogoStats>>()

vi.mock("@/lib/tmdb/fill", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tmdb/fill")>("@/lib/tmdb/fill")
  return { ...actual, fillSeriesLogos: (...args: unknown[]) => fillSeriesLogos(...args) }
})

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const EMPTY: SeriesLogoStats = {
  claimed: 0,
  found: 0,
  none: 0,
  errors: 0,
  skipped: 0,
  rateLimited: false,
  remaining: 0,
  dry: false,
  ms: 5,
}

function request(path = "/api/cron/series-logos", token: string | null = "test-secret") {
  return new NextRequest(`https://otakunaija.name.ng${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-secret")
  vi.stubEnv("TMDB_API_KEY", "tmdb-test-key")
  fillSeriesLogos.mockReset()
  fillSeriesLogos.mockResolvedValue(EMPTY)
})

describe("GET /api/cron/series-logos", () => {
  it("rejects a request without the cron secret", async () => {
    const response = await GET(request("/api/cron/series-logos", null))
    expect(response.status).toBe(401)
    expect(fillSeriesLogos).not.toHaveBeenCalled()
  })

  it("rejects a wrong secret", async () => {
    const response = await GET(request("/api/cron/series-logos", "nope"))
    expect(response.status).toBe(401)
  })

  it("returns the documented counters", async () => {
    fillSeriesLogos.mockResolvedValue({ ...EMPTY, claimed: 4, found: 2, none: 1, errors: 1, remaining: 9 })

    const response = await GET(request())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      claimed: 4,
      found: 2,
      none: 1,
      errors: 1,
      skipped: 0,
      rateLimited: false,
      remaining: 9,
      dry: false,
      batch: 20,
      disabled: false,
    })
    // The key never leaves the server.
    expect(JSON.stringify(json)).not.toContain("tmdb-test-key")
  })

  it("clamps the batch to 60 and honours anilist_id, force and dry", async () => {
    await GET(request("/api/cron/series-logos?batch=500&anilist_id=21&force=1&dry=1"))

    expect(fillSeriesLogos).toHaveBeenCalledWith({
      batch: 60,
      anilistId: 21,
      force: true,
      dry: true,
    })
  })

  it("falls back to 20 for a junk batch", async () => {
    await GET(request("/api/cron/series-logos?batch=lots"))
    expect(fillSeriesLogos.mock.calls[0][0]).toMatchObject({ batch: 20 })
  })

  it("ignores a junk anilist_id", async () => {
    await GET(request("/api/cron/series-logos?anilist_id=abc"))
    expect(fillSeriesLogos.mock.calls[0][0]).toMatchObject({ anilistId: null })
  })

  it("reports rate limiting when TMDB pushes back", async () => {
    fillSeriesLogos.mockResolvedValue({ ...EMPTY, rateLimited: true, retryAfterMs: 30000 })

    const json = await (await GET(request())).json()

    expect(json.rateLimited).toBe(true)
    expect(json.retryAfterMs).toBe(30000)
  })
})
