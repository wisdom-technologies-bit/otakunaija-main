/**
 * AniList "upcoming anime" data layer (pure half).
 *
 * Everything here is side-effect free apart from `anilistRequest`, which talks
 * to https://graphql.anilist.co. Nothing in this file touches our database and
 * nothing in this file renders: the pages always read from our cache tables
 * (see lib/anilist/upcoming-store.ts) so AniList is never hit per request.
 *
 * Style follows lib/anilist-backfill.ts: plain `fetch`, POSTed JSON, no SDK.
 */

export const ANILIST_ENDPOINT = "https://graphql.anilist.co"
export const ANILIST_USER_AGENT = "OtakuNaijaBot/1.0 (+https://otakunaija.name.ng)"

/** AniList's documented hard cap is 50 per page. */
export const PAGE_SIZE = 50
/** One 15 s timeout per HTTP attempt. */
export const REQUEST_TIMEOUT_MS = 15_000
/** A 429 is waited out once, and only if Retry-After is short enough. */
export const MAX_RETRY_WAIT_MS = 20_000
/** Default per-attempt wait when Retry-After is missing or unparseable. */
export const DEFAULT_RETRY_WAIT_MS = 3_000

export const DESCRIPTION_MAX_CHARS = 600
/** TBA titles with no date at all still matter when they are popular. */
export const TBA_POPULARITY_THRESHOLD = 2_000
/** How far ahead the dated "not yet released" sweep reaches. */
export const UPCOMING_HORIZON_MONTHS = 18
/** The airing schedule window we cache. */
export const SCHEDULE_WINDOW_DAYS = 8
/** A cached page older than this shows a "Last updated" warning. */
export const STALE_AFTER_HOURS = 36

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export type AniListFailureReason =
  | "rate_limited"
  | "http_error"
  | "graphql_error"
  | "network_error"

export type AniListResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: AniListFailureReason; status?: number; message?: string }

type RequestOptions = {
  timeoutMs?: number
  maxRetryWaitMs?: number
  /** Injected in tests so 429 handling can be exercised without real waiting. */
  fetchImpl?: typeof fetch
  sleepImpl?: (ms: number) => Promise<void>
}

export function parseRetryAfter(value: string | null, nowMs = Date.now()): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number.parseFloat(trimmed)
    if (!Number.isFinite(seconds) || seconds < 0) return null
    return Math.round(seconds * 1000)
  }

  const at = Date.parse(trimmed)
  if (Number.isNaN(at)) return null
  return Math.max(0, at - nowMs)
}

/**
 * POSTs a GraphQL query. Never throws and never returns a rejected promise:
 * callers branch on `ok`.
 */
export async function anilistRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: RequestOptions = {},
): Promise<AniListResult<T>> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS
  const maxRetryWaitMs = options.maxRetryWaitMs ?? MAX_RETRY_WAIT_MS
  const doFetch = options.fetchImpl ?? fetch
  const sleep = options.sleepImpl ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))

  const attempt = async (): Promise<Response | null> => {
    try {
      return await doFetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": ANILIST_USER_AGENT,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      })
    } catch {
      return null
    }
  }

  let response = await attempt()
  if (!response) return { ok: false, reason: "network_error" }

  if (response.status === 429) {
    const retryAfter = parseRetryAfter(response.headers.get("retry-after"))
    if (retryAfter === null || retryAfter > maxRetryWaitMs) {
      return { ok: false, reason: "rate_limited", status: 429 }
    }
    await sleep(retryAfter)
    response = await attempt()
    if (!response) return { ok: false, reason: "network_error" }
    if (response.status === 429) return { ok: false, reason: "rate_limited", status: 429 }
  }

  if (!response.ok) {
    return { ok: false, reason: "http_error", status: response.status }
  }

  let body: { data?: T; errors?: Array<{ message?: string }> } | null = null
  try {
    body = (await response.json()) as { data?: T; errors?: Array<{ message?: string }> }
  } catch {
    return { ok: false, reason: "graphql_error", status: response.status }
  }

  if (!body || body.data === undefined || body.data === null) {
    return {
      ok: false,
      reason: "graphql_error",
      status: response.status,
      message: body?.errors?.[0]?.message,
    }
  }

  return { ok: true, data: body.data }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  startDate { year month day }
  season
  seasonYear
  format
  status
  episodes
  duration
  genres
  studios(isMain: true) { nodes { name } }
  description(asHtml: false)
  popularity
  trailer { id site }
  source
  countryOfOrigin
  siteUrl
  nextAiringEpisode { airingAt episode }
  isAdult
`

/** Dated "not yet released" titles inside the horizon. */
export const UPCOMING_MEDIA_QUERY = `query ($page: Int, $perPage: Int, $from: FuzzyDateInt, $to: FuzzyDateInt) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, status: NOT_YET_RELEASED, isAdult: false, startDate_greater: $from, startDate_lesser: $to, sort: [START_DATE, POPULARITY_DESC]) {${MEDIA_FIELDS}}
  }
}`

/**
 * TBA sweep: `startDate_greater` cannot match a null start date, so undated
 * announcements need their own popularity-sorted query.
 */
export const TBA_MEDIA_QUERY = `query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, status: NOT_YET_RELEASED, isAdult: false, sort: POPULARITY_DESC) {${MEDIA_FIELDS}}
  }
}`

/** Currently airing shows (with their next episode) for the current season. */
export const RELEASING_MEDIA_QUERY = `query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, status: RELEASING, isAdult: false, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC) {${MEDIA_FIELDS}}
  }
}`

/** airingSchedules cannot filter adult content, so that is done client side. */
export const AIRING_SCHEDULE_QUERY = `query ($page: Int, $perPage: Int, $from: Int, $to: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      episode
      airingAt
      media {${MEDIA_FIELDS}}
    }
  }
}`

// ---------------------------------------------------------------------------
// Raw shapes
// ---------------------------------------------------------------------------

export type RawFuzzyDate = {
  year?: number | null
  month?: number | null
  day?: number | null
} | null

export type RawMedia = {
  id?: number | null
  idMal?: number | null
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null
  coverImage?: { extraLarge?: string | null; large?: string | null; color?: string | null } | null
  bannerImage?: string | null
  startDate?: RawFuzzyDate
  season?: string | null
  seasonYear?: number | null
  format?: string | null
  status?: string | null
  episodes?: number | null
  duration?: number | null
  genres?: string[] | null
  studios?: { nodes?: Array<{ name?: string | null }> | null } | null
  description?: string | null
  popularity?: number | null
  trailer?: { id?: string | null; site?: string | null } | null
  source?: string | null
  countryOfOrigin?: string | null
  siteUrl?: string | null
  nextAiringEpisode?: { airingAt?: number | null; episode?: number | null } | null
  isAdult?: boolean | null
}

export type RawAiringSchedule = {
  episode?: number | null
  airingAt?: number | null
  media?: RawMedia | null
}

export type RawPage = {
  Page?: {
    pageInfo?: { hasNextPage?: boolean | null } | null
    media?: RawMedia[] | null
    airingSchedules?: RawAiringSchedule[] | null
  } | null
}

// ---------------------------------------------------------------------------
// Normalised shapes (what we store)
// ---------------------------------------------------------------------------

export type UpcomingAnimeRow = {
  anilistId: number
  malId: number | null
  titleRomaji: string | null
  titleEnglish: string | null
  titleNative: string | null
  coverUrl: string | null
  coverColor: string | null
  bannerUrl: string | null
  format: string | null
  status: string | null
  season: string | null
  seasonYear: number | null
  startDate: string | null
  startYear: number | null
  startMonth: number | null
  startDay: number | null
  episodes: number | null
  duration: number | null
  genres: string[]
  studio: string | null
  description: string | null
  popularity: number | null
  trailerSite: string | null
  trailerId: string | null
  source: string | null
  country: string | null
  siteUrl: string | null
  nextAiringEpisode: number | null
  nextAiringAt: string | null
  isAdult: boolean
}

export type AiringScheduleRow = {
  anilistId: number
  episode: number
  airingAt: string
}

/** One row plus everything the UI needs, resolved against our catalogue. */
export type UpcomingItem = UpcomingAnimeRow & {
  /** English title first, then romaji, then native. */
  title: string
  /** `YYYY-MM-DD` when the start date is complete, otherwise null. */
  startDateIso: string | null
  /** Human start date ("Mar 12, 2027"), "TBA" when unknown. */
  startLabel: string
  /** True when this title also exists on OtakuNaija. */
  onSite: boolean
  seriesSlug: string | null
  /** Internal series page when `onSite`, otherwise the AniList page. */
  href: string
  /** Always the AniList page, for the "Details" link. */
  externalUrl: string | null
  /** YouTube trailer URL when AniList has one. */
  trailerUrl: string | null
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const isHex = entity[1]?.toLowerCase() === "x"
      const code = Number.parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10)
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match
      try {
        return String.fromCodePoint(code)
      } catch {
        return match
      }
    }
    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

/** Removes HTML tags, decodes entities and collapses whitespace. */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return ""
  const withoutTags = String(input)
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim()
}

/** Strips HTML and caps the description at DESCRIPTION_MAX_CHARS characters. */
export function normaliseDescription(input: string | null | undefined): string | null {
  const text = stripHtml(input)
  if (!text) return null
  if (text.length <= DESCRIPTION_MAX_CHARS) return text
  const clipped = text.slice(0, DESCRIPTION_MAX_CHARS - 1)
  const lastSpace = clipped.lastIndexOf(" ")
  const base = lastSpace > DESCRIPTION_MAX_CHARS - 80 ? clipped.slice(0, lastSpace) : clipped
  return `${base.trimEnd()}…`
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function optionalInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  return null
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

/** `YYYY-MM-DD` only when year, month and day are all known. */
export function fuzzyDateToIso(
  date: RawFuzzyDate | undefined,
): { iso: string | null; year: number | null; month: number | null; day: number | null } {
  const year = optionalInt(date?.year)
  const month = optionalInt(date?.month)
  const day = optionalInt(date?.day)
  const complete =
    year !== null &&
    month !== null &&
    day !== null &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31
  return {
    iso: complete ? `${year}-${pad2(month!)}-${pad2(day!)}` : null,
    year,
    month,
    day,
  }
}

/** AniList FuzzyDateInt form: YYYYMMDD. */
export function toFuzzyDateInt(date: Date): number {
  return date.getUTCFullYear() * 10_000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate()
}

export function unixSecondsToIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null
  const date = new Date(seconds * 1000)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export type Season = "WINTER" | "SPRING" | "SUMMER" | "FALL"

export function seasonForMonth(month: number): Season {
  if (month <= 3) return "WINTER"
  if (month <= 6) return "SPRING"
  if (month <= 9) return "SUMMER"
  return "FALL"
}

export function currentSeason(now: Date): { season: Season; year: number } {
  return { season: seasonForMonth(now.getUTCMonth() + 1), year: now.getUTCFullYear() }
}

const SEASON_ORDER: Season[] = ["WINTER", "SPRING", "SUMMER", "FALL"]

/** The next `count` seasons after the season `now` falls in. */
export function nextSeasons(now: Date, count = 2): Array<{ season: Season; year: number }> {
  const start = currentSeason(now)
  let index = SEASON_ORDER.indexOf(start.season)
  let year = start.year
  const out: Array<{ season: Season; year: number }> = []
  for (let i = 0; i < count; i++) {
    index += 1
    if (index > 3) {
      index = 0
      year += 1
    }
    out.push({ season: SEASON_ORDER[index], year })
  }
  return out
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** "Mar 12, 2027", or the season ("Winter 2027") when only that is known. */
export function startDateLabel(row: {
  startYear: number | null
  startMonth: number | null
  startDay: number | null
  season?: string | null
  seasonYear?: number | null
}): string {
  const { startYear, startMonth, startDay } = row
  if (startYear !== null && startMonth !== null && startDay !== null) {
    return `${SHORT_MONTHS[startMonth - 1]} ${startDay}, ${startYear}`
  }
  if (startYear !== null && startMonth !== null) {
    return `${SHORT_MONTHS[startMonth - 1]} ${startYear}`
  }
  if (startYear !== null) return String(startYear)
  if (row.season && row.seasonYear) {
    const name = row.season.charAt(0) + row.season.slice(1).toLowerCase()
    return `${name} ${row.seasonYear}`
  }
  return "TBA"
}

export function monthLabel(year: number, month: number): string {
  const name = MONTH_NAMES[month - 1]
  return name ? `${name} ${year}` : String(year)
}

/**
 * Months between `now` and a start date. Used for the 30 day countdown window.
 */
export function daysUntil(
  target: { startYear: number | null; startMonth: number | null; startDay: number | null },
  now: Date,
): number | null {
  if (target.startYear === null || target.startMonth === null || target.startDay === null) return null
  const at = Date.UTC(target.startYear, target.startMonth - 1, target.startDay)
  const diff = at - now.getTime()
  if (!Number.isFinite(diff)) return null
  return Math.floor(diff / 86_400_000)
}

/** `YYYY-MM-DD` for a date in an IANA time zone. */
export function dayKeyInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export type AiringDay<T> = {
  key: string
  /** Weekday name, replaced by "Today" for the current day. */
  label: string
  weekday: string
  /** "9 Nov" in the grouping time zone. */
  dateLabel: string
  isToday: boolean
  items: T[]
}

/**
 * Buckets airing entries into local days (Mon-Sun style, ascending), starting
 * today in `timeZone`. Empty days are dropped so a quiet week does not render
 * empty columns, but today is always present so the highlight has a home.
 */
export function groupAiringByDay<T>(
  items: T[],
  getAiringAt: (item: T) => string | Date | null | undefined,
  options: { now?: Date; timeZone?: string; days?: number } = {},
): AiringDay<T>[] {
  const now = options.now ?? new Date()
  const timeZone = options.timeZone ?? "Africa/Lagos"
  const days = Math.max(1, options.days ?? SCHEDULE_WINDOW_DAYS)

  const weekdayFormat = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long" })
  const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" })

  const buckets: AiringDay<T>[] = []
  const seen = new Set<string>()
  for (let i = 0; i < days; i++) {
    const at = new Date(now.getTime() + i * 86_400_000)
    const key = dayKeyInTimeZone(at, timeZone)
    if (seen.has(key)) continue
    seen.add(key)
    buckets.push({
      key,
      label: i === 0 ? "Today" : weekdayFormat.format(at),
      weekday: weekdayFormat.format(at),
      dateLabel: dateFormat.format(at),
      isToday: i === 0,
      items: [],
    })
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  for (const item of items) {
    const raw = getAiringAt(item)
    const date = raw ? (raw instanceof Date ? raw : new Date(raw)) : null
    if (!date || Number.isNaN(date.getTime())) continue
    const bucket = byKey.get(dayKeyInTimeZone(date, timeZone))
    if (!bucket) continue
    bucket.items.push(item)
  }

  return buckets.filter((bucket) => bucket.isToday || bucket.items.length > 0)
}

/** "18:30" in the given zone, plus that zone's short label ("WAT"). */
export function timeInZone(date: Date, timeZone: string): { time: string; zone: string } {
  const parts = new Intl.DateTimeFormat("en-NG", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).formatToParts(date)

  const time = `${parts.find((part) => part.type === "hour")?.value ?? "00"}:${
    parts.find((part) => part.type === "minute")?.value ?? "00"
  }`
  const zone = parts.find((part) => part.type === "timeZoneName")?.value ?? ""
  return { time, zone }
}

/** "just now", "3 hours ago", … for the staleness note. */
export function formatRelativeAge(value: string | Date | null | undefined, now: Date = new Date()): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return "just now"

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes === 1) return "1 minute ago"
  if (minutes < 60) return `${minutes} minutes ago`

  const hours = Math.floor(minutes / 60)
  if (hours === 1) return "1 hour ago"
  if (hours < 24) return `${hours} hours ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return "1 day ago"
  return `${days} days ago`
}

/** True when the cache is older than `hours` (or has never been filled). */
export function isStale(
  lastUpdated: string | Date | null | undefined,
  now: Date = new Date(),
  hours = STALE_AFTER_HOURS,
): boolean {
  if (!lastUpdated) return true
  const date = lastUpdated instanceof Date ? lastUpdated : new Date(lastUpdated)
  if (Number.isNaN(date.getTime())) return true
  return now.getTime() - date.getTime() > hours * 3_600_000
}

// ---------------------------------------------------------------------------
// Grouping by month (the "Later" tab)
// ---------------------------------------------------------------------------

export type MonthGroup<T> = { key: string; label: string; items: T[] }

/**
 * Groups upcoming titles by start month. Undated titles land in a trailing
 * "TBA" group so they are never silently dropped.
 */
export function groupByStartMonth<T extends {
  startYear: number | null
  startMonth: number | null
}>(items: T[]): MonthGroup<T>[] {
  const groups = new Map<string, MonthGroup<T>>()
  const tba: T[] = []

  for (const item of items) {
    if (item.startYear === null || item.startMonth === null) {
      tba.push(item)
      continue
    }
    const key = `${item.startYear}-${pad2(item.startMonth)}`
    const existing = groups.get(key)
    if (existing) existing.items.push(item)
    else groups.set(key, { key, label: monthLabel(item.startYear, item.startMonth), items: [item] })
  }

  const sorted = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))
  if (tba.length) sorted.push({ key: "tba", label: "Date to be announced", items: tba })
  return sorted
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const COVER_HOSTS = ["s4.anilist.co", "img.anili.st", "anilist.co"]

export function isAllowedCoverUrl(value: string | null | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return false
    return COVER_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

/**
 * Turns an AniList media object into a cache row.
 * Returns null for anything we must not show: adult titles and entries with no
 * usable cover.
 */
export function normaliseMedia(raw: RawMedia | null | undefined): UpcomingAnimeRow | null {
  if (!raw) return null
  const anilistId = optionalInt(raw.id)
  if (anilistId === null) return null
  const isAdult = raw.isAdult === true
  if (isAdult) return null

  const cover = optionalString(raw.coverImage?.extraLarge) ?? optionalString(raw.coverImage?.large)
  if (!isAllowedCoverUrl(cover)) return null

  const dates = fuzzyDateToIso(raw.startDate)
  const studios = raw.studios?.nodes ?? []
  const studio = optionalString(studios.find((node) => optionalString(node?.name))?.name)

  const trailerSite = optionalString(raw.trailer?.site)
  const trailerId = optionalString(raw.trailer?.id)

  return {
    anilistId,
    malId: optionalInt(raw.idMal),
    titleRomaji: optionalString(raw.title?.romaji),
    titleEnglish: optionalString(raw.title?.english),
    titleNative: optionalString(raw.title?.native),
    coverUrl: cover,
    coverColor: optionalString(raw.coverImage?.color),
    bannerUrl: optionalString(raw.bannerImage),
    format: optionalString(raw.format),
    status: optionalString(raw.status),
    season: optionalString(raw.season),
    seasonYear: optionalInt(raw.seasonYear),
    startDate: dates.iso,
    startYear: dates.year,
    startMonth: dates.month,
    startDay: dates.day,
    episodes: optionalInt(raw.episodes),
    duration: optionalInt(raw.duration),
    genres: Array.isArray(raw.genres) ? raw.genres.filter((genre) => typeof genre === "string" && genre.trim()).map((genre) => genre.trim()) : [],
    studio,
    description: normaliseDescription(raw.description),
    popularity: optionalInt(raw.popularity),
    trailerSite,
    trailerId: trailerSite === "youtube" ? trailerId : trailerId,
    source: optionalString(raw.source),
    country: optionalString(raw.countryOfOrigin),
    siteUrl: optionalString(raw.siteUrl),
    nextAiringEpisode: optionalInt(raw.nextAiringEpisode?.episode),
    nextAiringAt: unixSecondsToIso(raw.nextAiringEpisode?.airingAt),
    isAdult,
  }
}

/** airingSchedules rows -> media rows + schedule rows, adult filtered. */
export function normaliseAiringSchedules(rows: RawAiringSchedule[] | null | undefined): {
  media: UpcomingAnimeRow[]
  schedule: AiringScheduleRow[]
} {
  const media = new Map<number, UpcomingAnimeRow>()
  const schedule: AiringScheduleRow[] = []
  const seen = new Set<string>()

  for (const row of rows ?? []) {
    if (!row || row.media?.isAdult === true) continue
    const item = normaliseMedia(row.media)
    if (!item) continue
    const episode = optionalInt(row.episode)
    const airingAt = unixSecondsToIso(row.airingAt)
    if (episode === null || airingAt === null) continue

    const key = `${item.anilistId}:${episode}`
    if (seen.has(key)) continue
    seen.add(key)

    media.set(item.anilistId, media.get(item.anilistId) ?? item)
    schedule.push({ anilistId: item.anilistId, episode, airingAt })
  }

  return { media: [...media.values()], schedule }
}

/** Keeps the first occurrence of each anilist id. */
export function dedupeById(rows: UpcomingAnimeRow[]): UpcomingAnimeRow[] {
  const seen = new Set<number>()
  const out: UpcomingAnimeRow[] = []
  for (const row of rows) {
    if (seen.has(row.anilistId)) continue
    seen.add(row.anilistId)
    out.push(row)
  }
  return out
}

// ---------------------------------------------------------------------------
// On-site matching
// ---------------------------------------------------------------------------

const SEASON_SUFFIX = new RegExp(
  [
    "\\bseason\\s*\\d+\\b",
    "\\b\\d+(?:st|nd|rd|th)\\s+season\\b",
    "\\bpart\\s*\\d+\\b",
    "\\bpart\\s*(?:i{1,3}|iv|v)\\b",
    "\\bcour\\s*\\d+\\b",
    "\\bfinal\\s+season\\b",
    "\\b(?:ii|iii|iv|v)\\b$",
  ].join("|"),
  "gi",
)

/**
 * Folds a title down to something comparable across AniList and our catalogue:
 * case, punctuation, bracketed tags and season suffixes all disappear.
 *
 *   "Re:ZERO -Starting Life in Another World- Season 2" -> "re zero starting life in another world"
 *   "Attack on Titan  Final Season"                     -> "attack on titan"
 */
export function normaliseTitleForMatch(title: string | null | undefined): string {
  if (!title) return ""
  return String(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(SEASON_SUFFIX, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export type SeriesMatchRow = {
  id: number
  slug: string
  title: string
  anilistId: number | null
}

/**
 * Resolves cached AniList rows against our `series` table: exact `anilist_id`
 * first, then a normalised title. Later rows never steal a match that an
 * earlier (lower id) series already claimed.
 */
export function matchSeries(
  items: Array<{ anilistId: number; titleEnglish: string | null; titleRomaji: string | null; titleNative: string | null; title?: string }>,
  seriesRows: SeriesMatchRow[],
): Map<number, SeriesMatchRow> {
  const byAniListId = new Map<number, SeriesMatchRow>()
  const byTitle = new Map<string, SeriesMatchRow>()

  for (const row of [...seriesRows].sort((a, b) => a.id - b.id)) {
    if (row.anilistId !== null && !byAniListId.has(row.anilistId)) {
      byAniListId.set(row.anilistId, row)
    }
    const key = normaliseTitleForMatch(row.title)
    if (key && !byTitle.has(key)) byTitle.set(key, row)
  }

  const matches = new Map<number, SeriesMatchRow>()
  for (const item of items) {
    const direct = byAniListId.get(item.anilistId)
    if (direct) {
      matches.set(item.anilistId, direct)
      continue
    }
    const candidates = [item.title, item.titleEnglish, item.titleRomaji, item.titleNative]
    for (const candidate of candidates) {
      const key = normaliseTitleForMatch(candidate)
      if (!key) continue
      const hit = byTitle.get(key)
      if (hit) {
        matches.set(item.anilistId, hit)
        break
      }
    }
  }

  return matches
}

// ---------------------------------------------------------------------------
// Store-facing helpers
// ---------------------------------------------------------------------------

/** Splits rows into the chunks used for one multi-row statement each. */
export function chunkRows<T>(rows: T[], size = PAGE_SIZE): T[][] {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const width = Math.max(1, Math.trunc(size) || PAGE_SIZE)
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += width) out.push(rows.slice(i, i + width))
  return out
}

/** The JSON payload handed to `jsonb_to_recordset` for a media upsert. */
export function toMediaUpsertPayload(rows: UpcomingAnimeRow[]) {
  return rows.map((row) => ({
    anilist_id: row.anilistId,
    mal_id: row.malId,
    title_romaji: row.titleRomaji,
    title_english: row.titleEnglish,
    title_native: row.titleNative,
    cover_url: row.coverUrl,
    cover_color: row.coverColor,
    banner_url: row.bannerUrl,
    format: row.format,
    status: row.status,
    season: row.season,
    season_year: row.seasonYear,
    start_date: row.startDate,
    start_year: row.startYear,
    start_month: row.startMonth,
    start_day: row.startDay,
    episodes: row.episodes,
    duration: row.duration,
    genres: row.genres,
    studio: row.studio,
    description: row.description,
    popularity: row.popularity,
    trailer_site: row.trailerSite,
    trailer_id: row.trailerId,
    source: row.source,
    country: row.country,
    site_url: row.siteUrl,
    next_airing_episode: row.nextAiringEpisode,
    next_airing_at: row.nextAiringAt,
    is_adult: row.isAdult,
  }))
}

export function toScheduleUpsertPayload(rows: AiringScheduleRow[]) {
  return rows.map((row) => ({
    anilist_id: row.anilistId,
    episode: row.episode,
    airing_at: row.airingAt,
  }))
}

/** Items the UI can render: titles, labels and links resolved. */
export function toUpcomingItem(row: UpcomingAnimeRow, match: SeriesMatchRow | null): UpcomingItem {
  const title = row.titleEnglish || row.titleRomaji || row.titleNative || `AniList #${row.anilistId}`
  const trailerUrl =
    row.trailerSite === "youtube" && row.trailerId
      ? `https://www.youtube.com/watch?v=${row.trailerId}`
      : null

  return {
    ...row,
    title,
    startDateIso: row.startDate,
    startLabel: startDateLabel(row),
    onSite: Boolean(match),
    seriesSlug: match?.slug ?? null,
    href: match ? `/episodes/${match.slug}` : row.siteUrl ?? `https://anilist.co/anime/${row.anilistId}`,
    externalUrl: row.siteUrl ?? `https://anilist.co/anime/${row.anilistId}`,
    trailerUrl,
  }
}
