import { describe, expect, it, vi } from "vitest"
import {
  anilistRequest,
  chunkRows,
  daysUntil,
  dedupeById,
  formatRelativeAge,
  groupAiringByDay,
  groupByStartMonth,
  isStale,
  matchSeries,
  nextSeasons,
  normaliseDescription,
  normaliseMedia,
  normaliseTitleForMatch,
  normaliseAiringSchedules,
  parseRetryAfter,
  startDateLabel,
  stripHtml,
  timeInZone,
  toMediaUpsertPayload,
  toUpcomingItem,
  type RawMedia,
} from "./upcoming"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function media(overrides: Partial<RawMedia> = {}): RawMedia {
  return {
    id: 209895,
    idMal: 63824,
    title: { romaji: "Jujutsu Kaisen: Kouhen", english: "Jujutsu Kaisen: Part 2", native: "呪術廻戦" },
    coverImage: { extraLarge: "https://s4.anilist.co/file/cover.jpg", large: "https://s4.anilist.co/file/cover-l.jpg", color: "#1a2b3c" },
    bannerImage: null,
    startDate: { year: 2027, month: 3, day: 12 },
    season: "WINTER",
    seasonYear: 2027,
    format: "TV",
    status: "NOT_YET_RELEASED",
    episodes: 12,
    duration: 24,
    genres: ["Action", "Supernatural"],
    studios: { nodes: [{ name: "MAPPA" }] },
    description: "<p>The fourth season of <i>Jujutsu Kaisen</i>.</p>",
    popularity: 27482,
    trailer: { id: "HGCsAcFzaFw", site: "youtube" },
    source: "MANGA",
    countryOfOrigin: "JP",
    siteUrl: "https://anilist.co/anime/209895",
    nextAiringEpisode: { airingAt: 1_794_578_400, episode: 7 },
    isAdult: false,
    ...overrides,
  }
}

const response = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  })

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

describe("normaliseMedia", () => {
  it("maps a full AniList media object", () => {
    const row = normaliseMedia(media())
    expect(row).not.toBeNull()
    expect(row).toMatchObject({
      anilistId: 209895,
      malId: 63824,
      titleEnglish: "Jujutsu Kaisen: Part 2",
      titleRomaji: "Jujutsu Kaisen: Kouhen",
      coverUrl: "https://s4.anilist.co/file/cover.jpg",
      format: "TV",
      status: "NOT_YET_RELEASED",
      season: "WINTER",
      seasonYear: 2027,
      startDate: "2027-03-12",
      startYear: 2027,
      startMonth: 3,
      startDay: 12,
      episodes: 12,
      duration: 24,
      genres: ["Action", "Supernatural"],
      studio: "MAPPA",
      popularity: 27482,
      trailerSite: "youtube",
      trailerId: "HGCsAcFzaFw",
      source: "MANGA",
      country: "JP",
      siteUrl: "https://anilist.co/anime/209895",
      nextAiringEpisode: 7,
      nextAiringAt: new Date(1_794_578_400 * 1000).toISOString(),
      isAdult: false,
    })
  })

  it("keeps partial dates partial instead of inventing a day", () => {
    const monthOnly = normaliseMedia(media({ startDate: { year: 2027, month: 1, day: null } }))
    expect(monthOnly).toMatchObject({ startDate: null, startYear: 2027, startMonth: 1, startDay: null })
    expect(startDateLabel(monthOnly!)).toBe("Jan 2027")

    const tba = normaliseMedia(
      media({ startDate: { year: null, month: null, day: null }, season: "SPRING", seasonYear: 2028 }),
    )
    expect(tba).toMatchObject({ startDate: null, startYear: null })
    expect(startDateLabel(tba!)).toBe("Spring 2028")

    const fullyTba = normaliseMedia(media({ startDate: { year: null }, season: null, seasonYear: null }))
    expect(startDateLabel(fullyTba!)).toBe("TBA")
  })

  it("drops adult titles", () => {
    expect(normaliseMedia(media({ isAdult: true }))).toBeNull()
  })

  it("drops items with no usable cover", () => {
    expect(normaliseMedia(media({ coverImage: null }))).toBeNull()
    expect(normaliseMedia(media({ coverImage: { extraLarge: null, large: null } }))).toBeNull()
    // A cover that is not on an allowed AniList host is not trusted either.
    expect(normaliseMedia(media({ coverImage: { extraLarge: "https://evil.example/cover.jpg" } }))).toBeNull()
  })

  it("falls back to the large cover when extraLarge is missing", () => {
    const row = normaliseMedia(media({ coverImage: { extraLarge: null, large: "https://s4.anilist.co/file/l.jpg" } }))
    expect(row?.coverUrl).toBe("https://s4.anilist.co/file/l.jpg")
  })

  it("strips HTML from the description and collapses whitespace", () => {
    const row = normaliseMedia(media({ description: "<p>Hello&nbsp;<b>world</b> &amp; friends</p><br/>Next line" }))
    expect(row?.description).toBe("Hello world & friends Next line")
  })

  it("caps long descriptions at 600 characters", () => {
    const long = `<p>${"word ".repeat(300)}</p>`
    const row = normaliseMedia(media({ description: long }))
    expect(row?.description?.length).toBeLessThanOrEqual(600)
    expect(row?.description?.endsWith("…")).toBe(true)
  })

  it("keeps the trailer when present and nulls it when absent", () => {
    expect(normaliseMedia(media())?.trailerSite).toBe("youtube")
    const none = normaliseMedia(media({ trailer: null }))
    expect(none?.trailerSite).toBeNull()
    expect(none?.trailerId).toBeNull()
  })

  it("carries nextAiringEpisode through", () => {
    const next = normaliseMedia(media())
    expect(next?.nextAiringEpisode).toBe(7)
    expect(next?.nextAiringAt).toBe(new Date(1_794_578_400 * 1000).toISOString())
    const none = normaliseMedia(media({ nextAiringEpisode: null }))
    expect(none?.nextAiringEpisode).toBeNull()
    expect(none?.nextAiringAt).toBeNull()
  })
})

describe("stripHtml", () => {
  it("decodes entities and removes tags", () => {
    expect(stripHtml("<p>A &amp; B &#039;quoted&#039;</p>")).toBe("A & B 'quoted'")
    expect(stripHtml(null)).toBe("")
    expect(normaliseDescription("   ")).toBeNull()
  })
})

describe("normaliseAiringSchedules", () => {
  it("filters adult media (airingSchedules cannot do it server side)", () => {
    const { media: rows, schedule } = normaliseAiringSchedules([
      { episode: 5, airingAt: 1_762_700_400, media: media({ id: 1, isAdult: true }) },
      { episode: 9, airingAt: 1_762_704_000, media: media({ id: 2 }) },
      { episode: 9, airingAt: 1_762_704_000, media: media({ id: 2 }) }, // duplicate
      { episode: null, airingAt: 1_762_704_000, media: media({ id: 3 }) },
    ])
    expect(rows.map((row) => row.anilistId)).toEqual([2])
    expect(schedule).toEqual([{ anilistId: 2, episode: 9, airingAt: new Date(1_762_704_000 * 1000).toISOString() }])
  })
})

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

describe("parseRetryAfter", () => {
  it("understands seconds and HTTP dates", () => {
    expect(parseRetryAfter("3")).toBe(3000)
    expect(parseRetryAfter("0")).toBe(0)
    expect(parseRetryAfter(null)).toBeNull()
    expect(parseRetryAfter("nonsense")).toBeNull()
    expect(parseRetryAfter(new Date(1_700_000_010_000).toUTCString(), 1_700_000_000_000)).toBe(10_000)
  })
})

describe("anilistRequest", () => {
  it("posts the query and returns data", async () => {
    const fetchImpl = vi.fn(async () => response({ data: { Page: { media: [] } } }))
    const result = await anilistRequest("query { x }", { a: 1 }, { fetchImpl: fetchImpl as unknown as typeof fetch })

    expect(result).toEqual({ ok: true, data: { Page: { media: [] } } })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://graphql.anilist.co")
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>)["user-agent"]).toBe(
      "OtakuNaijaBot/1.0 (+https://otakunaija.name.ng)",
    )
    expect(JSON.parse(String(init.body))).toEqual({ query: "query { x }", variables: { a: 1 } })
  })

  it("waits out a short 429 once and retries", async () => {
    const sleepImpl = vi.fn(async () => {})
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({}, { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(response({ data: { Page: {} } }))

    const result = await anilistRequest("q", {}, { fetchImpl: fetchImpl as unknown as typeof fetch, sleepImpl })

    expect(sleepImpl).toHaveBeenCalledWith(2000)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(true)
  })

  it("gives up as rate_limited when Retry-After is longer than 20s", async () => {
    const sleepImpl = vi.fn(async () => {})
    const fetchImpl = vi.fn(async () => response({}, { status: 429, headers: { "retry-after": "60" } }))

    const result = await anilistRequest("q", {}, { fetchImpl: fetchImpl as unknown as typeof fetch, sleepImpl })

    expect(result).toEqual({ ok: false, reason: "rate_limited", status: 429 })
    expect(sleepImpl).not.toHaveBeenCalled()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("returns rate_limited when the retry is also a 429", async () => {
    const fetchImpl = vi.fn(async () => response({}, { status: 429, headers: { "retry-after": "1" } }))
    const result = await anilistRequest("q", {}, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => {},
    })
    expect(result).toMatchObject({ ok: false, reason: "rate_limited" })
  })

  it("never throws on network failure or a broken body", async () => {
    const boom = vi.fn(async () => {
      throw new Error("socket hang up")
    })
    await expect(
      anilistRequest("q", {}, { fetchImpl: boom as unknown as typeof fetch }),
    ).resolves.toEqual({ ok: false, reason: "network_error" })

    const bogus = vi.fn(async () => new Response("not json", { status: 200 }))
    await expect(
      anilistRequest("q", {}, { fetchImpl: bogus as unknown as typeof fetch }),
    ).resolves.toMatchObject({ ok: false, reason: "graphql_error" })

    const badStatus = vi.fn(async () => response({ errors: [{ message: "bad" }] }, { status: 500 }))
    await expect(
      anilistRequest("q", {}, { fetchImpl: badStatus as unknown as typeof fetch }),
    ).resolves.toMatchObject({ ok: false, reason: "http_error", status: 500 })
  })
})

// ---------------------------------------------------------------------------
// Store payload helpers
// ---------------------------------------------------------------------------

describe("chunkRows", () => {
  it("splits rows into one statement per chunk of 50", () => {
    const rows = Array.from({ length: 120 }, (_, index) => index)
    const chunks = chunkRows(rows, 50)
    expect(chunks.map((chunk) => chunk.length)).toEqual([50, 50, 20])
    expect(chunkRows([], 50)).toEqual([])
    expect(chunkRows([1, 2], 0)).toEqual([[1, 2]])
  })
})

describe("toMediaUpsertPayload", () => {
  it("maps camelCase rows onto the recordset columns", () => {
    const row = normaliseMedia(media())!
    const [payload] = toMediaUpsertPayload([row])
    expect(payload).toMatchObject({
      anilist_id: 209895,
      title_english: "Jujutsu Kaisen: Part 2",
      cover_url: "https://s4.anilist.co/file/cover.jpg",
      start_date: "2027-03-12",
      genres: ["Action", "Supernatural"],
      next_airing_episode: 7,
      is_adult: false,
    })
  })

  it("keeps the first row per anilist id", () => {
    const first = normaliseMedia(media({ title: { english: "First" } }))!
    const second = normaliseMedia(media({ title: { english: "Second" } }))!
    expect(dedupeById([first, second])).toHaveLength(1)
    expect(dedupeById([first, second])[0].titleEnglish).toBe("First")
  })
})

// ---------------------------------------------------------------------------
// Staleness + dates
// ---------------------------------------------------------------------------

describe("staleness note", () => {
  const now = new Date("2026-11-09T12:00:00Z")

  it("treats a missing or invalid timestamp as stale", () => {
    expect(isStale(null, now)).toBe(true)
    expect(isStale("not-a-date", now)).toBe(true)
  })

  it("goes stale after 36 hours", () => {
    expect(isStale("2026-11-08T12:00:00Z", now)).toBe(false)
    // Exactly 36 hours old is still fresh; 37 hours is stale.
    expect(isStale("2026-11-08T00:00:00Z", now)).toBe(false)
    expect(isStale("2026-11-07T23:00:00Z", now)).toBe(true)
  })

  it("formats a relative age for the page", () => {
    expect(formatRelativeAge("2026-11-09T11:59:30Z", now)).toBe("just now")
    expect(formatRelativeAge("2026-11-09T11:00:00Z", now)).toBe("1 hour ago")
    expect(formatRelativeAge("2026-11-09T09:00:00Z", now)).toBe("3 hours ago")
    expect(formatRelativeAge("2026-11-07T12:00:00Z", now)).toBe("2 days ago")
    expect(formatRelativeAge(null, now)).toBeNull()
  })

  it("computes the countdown window from a partial date", () => {
    expect(daysUntil({ startYear: 2026, startMonth: 11, startDay: 19 }, now)).toBe(9)
    expect(daysUntil({ startYear: null, startMonth: null, startDay: null }, now)).toBeNull()
  })

  it("knows the next two seasons", () => {
    expect(nextSeasons(new Date("2026-11-09T00:00:00Z"), 2)).toEqual([
      { season: "WINTER", year: 2027 },
      { season: "SPRING", year: 2027 },
    ])
    expect(nextSeasons(new Date("2026-12-20T00:00:00Z"), 2)).toEqual([
      { season: "WINTER", year: 2027 },
      { season: "SPRING", year: 2027 },
    ])
  })
})

describe("groupAiringByDay", () => {
  const items = [
    { id: "a", airingAt: "2026-11-09T23:30:00Z" }, // 00:30 on the 10th in Lagos
    { id: "b", airingAt: "2026-11-09T10:00:00Z" }, // 11:00 on the 9th in Lagos
    { id: "c", airingAt: "2026-11-20T10:00:00Z" }, // outside the window
  ]
  const now = new Date("2026-11-09T09:00:00Z")

  it("uses the Lagos calendar so a late UTC episode lands on tomorrow", () => {
    const days = groupAiringByDay(items, (item) => item.airingAt, { now, timeZone: "Africa/Lagos", days: 8 })
    expect(days[0].key).toBe("2026-11-09")
    expect(days[0].isToday).toBe(true)
    expect(days[0].items.map((item) => item.id)).toEqual(["b"])
    expect(days[1].key).toBe("2026-11-10")
    expect(days[1].items.map((item) => item.id)).toEqual(["a"])
    // Nothing outside the 8 day window is shown.
    expect(days.flatMap((day) => day.items)).toHaveLength(2)
  })

  it("puts the same episode on today when grouping in UTC", () => {
    const days = groupAiringByDay(items, (item) => item.airingAt, { now, timeZone: "UTC", days: 8 })
    expect(days[0].key).toBe("2026-11-09")
    expect(days[0].items.map((item) => item.id)).toEqual(["a", "b"].sort())
  })

  it("always keeps today, drops quiet days, and labels it Today", () => {
    const days = groupAiringByDay([], () => null, { now, timeZone: "Africa/Lagos", days: 8 })
    expect(days).toHaveLength(1)
    expect(days[0]).toMatchObject({ label: "Today", isToday: true, items: [] })
  })

  it("shows the zone label for the fallback zone", () => {
    expect(timeInZone(new Date("2026-11-10T17:30:00Z"), "Africa/Lagos")).toEqual({ time: "18:30", zone: "WAT" })
  })
})

describe("groupByStartMonth", () => {
  it("groups by month and keeps undated titles in a trailing TBA group", () => {
    const groups = groupByStartMonth([
      { title: "B", startYear: 2027, startMonth: 4 },
      { title: "A", startYear: 2027, startMonth: 1 },
      { title: "TBA", startYear: null, startMonth: null },
      { title: "C", startYear: 2027, startMonth: 1 },
    ])
    expect(groups.map((group) => group.key)).toEqual(["2027-01", "2027-04", "tba"])
    expect(groups[0].label).toBe("January 2027")
    expect(groups[0].items.map((item) => item.title)).toEqual(["A", "C"])
  })
})

// ---------------------------------------------------------------------------
// On-site matching
// ---------------------------------------------------------------------------

describe("normaliseTitleForMatch", () => {
  it("folds case, punctuation and season suffixes", () => {
    expect(normaliseTitleForMatch("Re:ZERO -Starting Life in Another World-")).toBe(
      "re zero starting life in another world",
    )
    expect(normaliseTitleForMatch("Attack on Titan Season 4")).toBe("attack on titan")
    expect(normaliseTitleForMatch("Attack on Titan 4th Season")).toBe("attack on titan")
    expect(normaliseTitleForMatch("Demon Slayer: Kimetsu no Yaiba (TV)")).toBe("demon slayer kimetsu no yaiba")
    expect(normaliseTitleForMatch("Mushoku Tensei II")).toBe("mushoku tensei")
    expect(normaliseTitleForMatch("Jujutsu Kaisen Part 2")).toBe("jujutsu kaisen")
    expect(normaliseTitleForMatch(null)).toBe("")
  })
})

describe("matchSeries", () => {
  const seriesRows = [
    { id: 7, slug: "one-piece", title: "One Piece", anilistId: 21 },
    { id: 3, slug: "jujutsu-kaisen", title: "Jujutsu Kaisen", anilistId: null },
    { id: 9, slug: "attack-on-titan", title: "Attack on Titan", anilistId: null },
  ]

  it("prefers the anilist id", () => {
    const matches = matchSeries(
      [{ anilistId: 21, titleEnglish: "Something else", titleRomaji: null, titleNative: null }],
      seriesRows,
    )
    expect(matches.get(21)?.slug).toBe("one-piece")
  })

  it("falls back to a normalised title, including season suffixes", () => {
    const matches = matchSeries(
      [
        { anilistId: 101, titleEnglish: "Jujutsu Kaisen Season 3", titleRomaji: null, titleNative: null },
        { anilistId: 102, titleEnglish: null, titleRomaji: "Shingeki no Kyojin", titleNative: null },
        { anilistId: 103, titleEnglish: "ATTACK ON TITAN: FINAL SEASON", titleRomaji: null, titleNative: null },
        { anilistId: 104, titleEnglish: "Unrelated Show", titleRomaji: null, titleNative: null },
      ],
      seriesRows,
    )
    expect(matches.get(101)?.slug).toBe("jujutsu-kaisen")
    expect(matches.get(103)?.slug).toBe("attack-on-titan")
    expect(matches.get(104)).toBeUndefined()
    expect(matches.get(102)).toBeUndefined()
  })

  it("builds hrefs: internal when matched, AniList otherwise", () => {
    const row = normaliseMedia(media())!
    const onSite = toUpcomingItem(row, { id: 3, slug: "jujutsu-kaisen", title: "Jujutsu Kaisen", anilistId: null })
    expect(onSite.onSite).toBe(true)
    expect(onSite.href).toBe("/episodes/jujutsu-kaisen")
    expect(onSite.title).toBe("Jujutsu Kaisen: Part 2")
    expect(onSite.startLabel).toBe("Mar 12, 2027")
    expect(onSite.trailerUrl).toBe("https://www.youtube.com/watch?v=HGCsAcFzaFw")

    const offSite = toUpcomingItem(row, null)
    expect(offSite.onSite).toBe(false)
    expect(offSite.seriesSlug).toBeNull()
    expect(offSite.href).toBe("https://anilist.co/anime/209895")
    expect(offSite.externalUrl).toBe("https://anilist.co/anime/209895")
  })
})
