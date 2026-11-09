import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { UpcomingRefreshResult } from "@/lib/anilist/upcoming-store"
import { GET, POST } from "./route"

const mocks = vi.hoisted(() => ({
  refreshUpcoming: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/anilist/upcoming-store", () => ({
  UPCOMING_CACHE_TAG: "upcoming-anime",
  DEFAULT_DEADLINE_MS: 45_000,
  clampPageCap: (limit: number | undefined) => {
    if (limit === undefined || !Number.isFinite(limit)) return 3
    return Math.min(10, Math.max(1, Math.trunc(limit)))
  },
  refreshUpcoming: (...args: unknown[]) => mocks.refreshUpcoming(...args),
}))

vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => mocks.revalidateTag(...args),
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}))

const RESULT: UpcomingRefreshResult = {
  fetched: 0,
  upserted: 0,
  schedule: 0,
  onSite: 0,
  rateLimited: false,
  dry: false,
  written: false,
  ms: 12,
  errors: [],
}

function request(path = "/api/cron/upcoming", token: string | null = "test-secret") {
  return new NextRequest(`https://otakunaija.name.ng${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-secret")
  mocks.refreshUpcoming.mockReset()
  mocks.revalidateTag.mockReset()
  mocks.revalidatePath.mockReset()
  mocks.refreshUpcoming.mockResolvedValue({ ...RESULT, fetched: 4, upserted: 4 })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("/api/cron/upcoming authorization", () => {
  it("returns 401 without a bearer token", async () => {
    const response = await GET(request("/api/cron/upcoming", null))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
    expect(mocks.refreshUpcoming).not.toHaveBeenCalled()
  })

  it("returns 401 with the wrong token", async () => {
    const response = await GET(request("/api/cron/upcoming", "nope"))
    expect(response.status).toBe(401)
    expect(mocks.refreshUpcoming).not.toHaveBeenCalled()
  })

  it("returns 401 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "")
    const response = await GET(request("/api/cron/upcoming", ""))
    expect(response.status).toBe(401)
    expect(mocks.refreshUpcoming).not.toHaveBeenCalled()
  })
})

describe("/api/cron/upcoming behaviour", () => {
  it("returns the documented JSON shape", async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      fetched: 4,
      upserted: 4,
      schedule: 0,
      onSite: 0,
      rateLimited: false,
      dry: false,
      written: false,
    })
    expect(typeof body.ms).toBe("number")
    expect(Array.isArray(body.errors)).toBe(true)
  })

  it("dry=1 writes nothing and does not revalidate", async () => {
    mocks.refreshUpcoming.mockResolvedValue({ ...RESULT, dry: true, fetched: 7, upserted: 7 })

    const response = await GET(request("/api/cron/upcoming?dry=1"))
    expect(response.status).toBe(200)
    expect(mocks.refreshUpcoming).toHaveBeenCalledWith({ dry: true, limit: undefined })
    expect(mocks.revalidateTag).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("forwards and clamps the page limit", async () => {
    await GET(request("/api/cron/upcoming?limit=2"))
    expect(mocks.refreshUpcoming).toHaveBeenCalledWith({ dry: false, limit: 2 })

    await GET(request("/api/cron/upcoming?limit=999"))
    expect(mocks.refreshUpcoming).toHaveBeenLastCalledWith({ dry: false, limit: 10 })
  })

  it("revalidates the tag and both episode pages after a real write", async () => {
    mocks.refreshUpcoming.mockResolvedValue({ ...RESULT, fetched: 9, upserted: 9, written: true })

    await GET(request("/api/cron/upcoming"))

    expect(mocks.revalidateTag).toHaveBeenCalledWith("upcoming-anime", "max")
    expect(mocks.revalidatePath.mock.calls.map((call) => call[0])).toEqual([
      "/episodes/upcoming",
      "/episodes",
    ])
  })

  it("returns 502 when nothing could be fetched", async () => {
    mocks.refreshUpcoming.mockResolvedValue({
      ...RESULT,
      fetched: 0,
      errors: ["upcoming: rate_limited (429)"],
      rateLimited: true,
    })

    const response = await GET(request("/api/cron/upcoming"))
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({ fetched: 0, rateLimited: true })
  })
})
