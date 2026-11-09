import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { NewsRunResult } from "@/lib/news/ingest"
import { GET, POST } from "./route"

const runNewsIngest = vi.fn<(...args: unknown[]) => Promise<NewsRunResult>>()

vi.mock("@/lib/news/ingest", async () => {
  const actual = await vi.importActual<typeof import("@/lib/news/ingest")>("@/lib/news/ingest")
  return { ...actual, runNewsIngest: (...args: unknown[]) => runNewsIngest(...args) }
})

const EMPTY_RESULT: NewsRunResult = {
  fetched: 0,
  new: 0,
  published: 0,
  rewritten: 0,
  failed: 0,
  skipped: 0,
  remaining: 0,
  imageReasons: {},
  dry: false,
  log: [],
}

function request(path = "/api/cron/news", token: string | null = "test-secret") {
  return new NextRequest(`https://otakunaija.name.ng${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-secret")
  vi.stubEnv("GROQ_API_KEY", "groq-test-key")
  runNewsIngest.mockReset()
  runNewsIngest.mockResolvedValue(EMPTY_RESULT)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("/api/cron/news authorization", () => {
  it("returns 401 without a bearer token", async () => {
    const response = await GET(request("/api/cron/news", null))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
    expect(runNewsIngest).not.toHaveBeenCalled()
  })

  it("returns 401 with the wrong token", async () => {
    const response = await GET(request("/api/cron/news", "nope"))
    expect(response.status).toBe(401)
    expect(runNewsIngest).not.toHaveBeenCalled()
  })

  it("returns 401 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "")
    const response = await GET(request("/api/cron/news", ""))
    expect(response.status).toBe(401)
    expect(runNewsIngest).not.toHaveBeenCalled()
  })
})

describe("/api/cron/news behaviour", () => {
  it("passes dry=1 and limit to the pipeline without publishing", async () => {
    const dryResult: NewsRunResult = { ...EMPTY_RESULT, dry: true, fetched: 12, new: 3 }
    runNewsIngest.mockResolvedValue(dryResult)

    const response = await GET(request("/api/cron/news?dry=1&limit=1"))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ dry: true, fetched: 12, new: 3 })
    expect(runNewsIngest).toHaveBeenCalledWith({ dry: true, limit: 1, forceGuid: null })
  })

  it("forwards force_guid", async () => {
    await POST(request("/api/cron/news?force_guid=https://www.animenewsnetwork.com/cms/.243614"))
    expect(runNewsIngest).toHaveBeenCalledWith({
      dry: false,
      limit: undefined,
      forceGuid: "https://www.animenewsnetwork.com/cms/.243614",
    })
  })

  it("returns the documented counters", async () => {
    runNewsIngest.mockResolvedValue({
      ...EMPTY_RESULT,
      fetched: 139,
      new: 4,
      published: 1,
      rewritten: 1,
      failed: 1,
      skipped: 2,
      remaining: 12,
    })
    const payload = (await (await GET(request())).json()) as Record<string, number | boolean>
    expect(payload).toMatchObject({
      fetched: 139,
      new: 4,
      published: 1,
      rewritten: 1,
      failed: 1,
      skipped: 2,
      remaining: 12,
      dry: false,
    })
  })

  it("returns 502 when the feed could not be read", async () => {
    runNewsIngest.mockResolvedValue({ ...EMPTY_RESULT, error: "feed_http_503", log: ["feed failed"] })
    const response = await GET(request())
    expect(response.status).toBe(502)
  })

  it("refuses to run without GROQ_API_KEY", async () => {
    vi.stubEnv("GROQ_API_KEY", "")
    const response = await GET(request())
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: "GROQ_API_KEY is not configured" })
    expect(runNewsIngest).not.toHaveBeenCalled()
  })

  it("still allows a dry run without GROQ_API_KEY", async () => {
    vi.stubEnv("GROQ_API_KEY", "")
    const response = await GET(request("/api/cron/news?dry=1"))
    expect(response.status).toBe(200)
    expect(runNewsIngest).toHaveBeenCalled()
  })
})
