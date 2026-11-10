import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchLogoFor,
  findTmdbIdByImdb,
  identityFromMapping,
  logoUrl,
  pickBestLogo,
  tmdbConfigured,
  tmdbIdFromMappings,
} from "./logos"

const ORIGINAL_ENV = { ...process.env }

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
})

describe("tmdbConfigured", () => {
  it("needs one of the two credentials", () => {
    delete process.env.TMDB_API_KEY
    delete process.env.TMDB_READ_ACCESS_TOKEN
    expect(tmdbConfigured()).toBe(false)

    process.env.TMDB_API_KEY = "v3-key"
    expect(tmdbConfigured()).toBe(true)
  })
})

describe("tmdbIdFromMappings", () => {
  it("reads themoviedbId, tmdbId, numeric strings and JSON text", () => {
    expect(tmdbIdFromMappings({ themoviedbId: 123 })).toBe(123)
    expect(tmdbIdFromMappings({ tmdbId: "456" })).toBe(456)
    expect(tmdbIdFromMappings(JSON.stringify({ themoviedbId: 789 }))).toBe(789)
  })

  it("returns null instead of guessing", () => {
    expect(tmdbIdFromMappings(null)).toBeNull()
    expect(tmdbIdFromMappings({})).toBeNull()
    expect(tmdbIdFromMappings({ themoviedbId: 0 })).toBeNull()
    expect(tmdbIdFromMappings({ tmdbId: "abc" })).toBeNull()
    expect(tmdbIdFromMappings("[1,2]")).toBeNull()
    expect(tmdbIdFromMappings("not json")).toBeNull()
  })
})

describe("identityFromMapping", () => {
  it("normalises a nested Anivexa payload", () => {
    const identity = identityFromMapping({
      mappings: JSON.stringify({ themoviedbId: 95479, imdbId: "tt1234567", thetvdbId: 12345 }),
      format: "TV",
      tmdbSeason: 2,
    })

    expect(identity).toEqual({
      tmdbId: 95479,
      imdbId: "tt1234567",
      tvdbId: 12345,
      format: "TV",
      tmdbSeason: 2,
      media: "tv",
    })
  })

  it("treats MOVIE as the movie media type", () => {
    const identity = identityFromMapping({ mappings: { themoviedbId: 11 }, format: "MOVIE" })
    expect(identity.media).toBe("movie")
  })

  it("survives a payload with nothing useful", () => {
    expect(identityFromMapping({})).toMatchObject({ tmdbId: null, imdbId: null, media: "tv" })
    expect(identityFromMapping(null).tmdbId).toBeNull()
  })
})

describe("pickBestLogo", () => {
  const logos = [
    { file_path: "/de.png", iso_639_1: "de", vote_average: 9, vote_count: 90, aspect_ratio: 3, width: 1200 },
    { file_path: "/en.png", iso_639_1: "en", vote_average: 4, vote_count: 4, aspect_ratio: 3.2, width: 1000 },
    { file_path: "/null.png", iso_639_1: null, vote_average: 8, vote_count: 80, aspect_ratio: 2.9, width: 900 },
  ]

  it("prefers en, then no language, then votes", () => {
    expect(pickBestLogo(logos)?.path).toBe("/en.png")
    expect(pickBestLogo(logos.filter((l) => l.iso_639_1 !== "en"))?.path).toBe("/null.png")
  })

  it("breaks ties on vote count, then width", () => {
    const tied = [
      { file_path: "/a.png", iso_639_1: null, vote_average: 5, vote_count: 2, aspect_ratio: 3, width: 800 },
      { file_path: "/b.png", iso_639_1: null, vote_average: 5, vote_count: 9, aspect_ratio: 3, width: 700 },
      { file_path: "/c.png", iso_639_1: null, vote_average: 5, vote_count: 9, aspect_ratio: 3, width: 1500 },
    ]
    expect(pickBestLogo(tied)?.path).toBe("/c.png")
  })

  it("only accepts safe TMDB file paths and sane images", () => {
    const rejected = [
      { file_path: "https://evil.example/x.png", aspect_ratio: 3, width: 1000 },
      { file_path: "/x.png?api_key=1", aspect_ratio: 3, width: 1000 },
      { file_path: "/../etc/passwd.png", aspect_ratio: 3, width: 1000 },
      { file_path: "/x.exe", aspect_ratio: 3, width: 1000 },
      { file_path: "/x.png", aspect_ratio: 0.1, width: 1000 },
      { file_path: "/x.png", aspect_ratio: 3, width: 10 },
    ]
    expect(pickBestLogo(rejected)).toBeNull()
    expect(pickBestLogo([])).toBeNull()
    expect(pickBestLogo("nope")).toBeNull()
  })

  it("reports the aspect ratio and width it picked", () => {
    expect(pickBestLogo(logos)).toEqual({ path: "/en.png", aspectRatio: 3.2, width: 1000 })
  })
})

describe("logoUrl", () => {
  it("builds a w500 URL", () => {
    expect(logoUrl("/abc123.png")).toBe("https://image.tmdb.org/t/p/w500/abc123.png")
  })

  it("falls back to w500 for an unknown size", () => {
    expect(logoUrl("/abc123.png", "w99999")).toBe("https://image.tmdb.org/t/p/w500/abc123.png")
  })

  it("refuses anything that is not a TMDB path", () => {
    expect(logoUrl("https://evil.example/logo.png")).toBeNull()
    expect(logoUrl(null)).toBeNull()
    expect(logoUrl("/x.svg")).toBe("https://image.tmdb.org/t/p/w500/x.svg")
  })
})

describe("fetchLogoFor", () => {
  beforeEach(() => {
    process.env.TMDB_API_KEY = "super-secret-key"
  })

  it("falls through to the other media type on a 404", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/tv/42/images")) return new Response("missing", { status: 404 })
      return jsonResponse({ logos: [{ file_path: "/logo.png", iso_639_1: "en", aspect_ratio: 3, width: 1000 }] })
    })

    const result = await fetchLogoFor({ tmdbId: 42, format: "TV" })

    expect(result.status).toBe("found")
    if (result.status === "found") {
      expect(result.logo.path).toBe("/logo.png")
      expect(result.media).toBe("movie")
    }
    expect(calls).toHaveLength(2)
    expect(calls[0]).toContain("/tv/42/images")
    expect(calls[1]).toContain("/movie/42/images")
  })

  it("asks for both languages", async () => {
    let url = ""
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      url = String(input)
      return jsonResponse({ logos: [] })
    })

    await fetchLogoFor({ tmdbId: 7, format: "MOVIE" })

    expect(url).toContain("include_image_language=en%2Cnull")
    expect(url).toContain("/movie/7/images")
  })

  it("reports rate limiting with the retry window", async () => {
    vi.stubGlobal("fetch", async () => new Response("slow down", { status: 429, headers: { "retry-after": "7" } }))

    const result = await fetchLogoFor({ tmdbId: 42 })

    expect(result).toEqual({ status: "rate_limited", retryAfterMs: 7000 })
  })

  it("never puts the key in an error message", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      throw new Error(`connect ECONNREFUSED ${String(input)}`)
    })

    const result = await fetchLogoFor({ tmdbId: 42 })

    expect(result.status).toBe("error")
    if (result.status === "error") {
      expect(result.message).not.toContain("super-secret-key")
      expect(result.message).toBe("TMDB request failed")
    }
  })

  it("is disabled without credentials and never calls out", async () => {
    delete process.env.TMDB_API_KEY
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    expect(await fetchLogoFor({ tmdbId: 42 })).toEqual({ status: "disabled" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns none for a missing id", async () => {
    expect(await fetchLogoFor({ tmdbId: null })).toEqual({ status: "none", media: null })
  })
})

describe("findTmdbIdByImdb", () => {
  beforeEach(() => {
    process.env.TMDB_API_KEY = "super-secret-key"
  })

  it("resolves a tv result", async () => {
    let url = ""
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      url = String(input)
      return jsonResponse({ tv_results: [{ id: 95479 }], movie_results: [] })
    })

    expect(await findTmdbIdByImdb("tt1234567")).toEqual({ status: "ok", tmdbId: 95479, media: "tv" })
    expect(url).toContain("/find/tt1234567")
    expect(url).toContain("external_source=imdb_id")
  })

  it("falls back to a movie result", async () => {
    vi.stubGlobal("fetch", async () => jsonResponse({ tv_results: [], movie_results: [{ id: 603 }] }))
    expect(await findTmdbIdByImdb("tt0133093")).toEqual({ status: "ok", tmdbId: 603, media: "movie" })
  })

  it("is none for an unknown or malformed id", async () => {
    vi.stubGlobal("fetch", async () => jsonResponse({ tv_results: [], movie_results: [] }))
    expect(await findTmdbIdByImdb("tt9999999")).toEqual({ status: "none" })
    expect(await findTmdbIdByImdb("not-an-id")).toEqual({ status: "none" })
  })

  it("passes rate limiting through", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 429, headers: { "retry-after": "2" } }))
    expect(await findTmdbIdByImdb("tt1234567")).toEqual({ status: "rate_limited", retryAfterMs: 2000 })
  })
})
