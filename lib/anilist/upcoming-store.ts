/**
 * AniList "upcoming anime" data layer (database half).
 *
 * Two responsibilities:
 *
 *  1. The store: chunked upserts into `upcoming_anime` + `airing_schedule`,
 *     pruning, and the readers every page uses. Tables ship as the hand-run
 *     SQL file docs/sql/upcoming-anime.sql (same approach as lib/news/store.ts),
 *     so there is no Drizzle schema for them.
 *  2. `refreshUpcoming()`: the only code path that talks to AniList. It is
 *     called by app/api/cron/upcoming/route.ts on a schedule, never by a page.
 *
 * Pages read from the cache tables only, so AniList being down never empties
 * the section: readers fall back to [] instead of throwing.
 */

import { unstable_cache } from "next/cache"
import { sql } from "@/lib/db"
import { LAGOS_TIME_ZONE } from "@/lib/format-date"
import {
  AIRING_SCHEDULE_QUERY,
  PAGE_SIZE,
  RELEASING_MEDIA_QUERY,
  SCHEDULE_WINDOW_DAYS,
  STALE_AFTER_HOURS,
  TBA_MEDIA_QUERY,
  TBA_POPULARITY_THRESHOLD,
  UPCOMING_HORIZON_MONTHS,
  UPCOMING_MEDIA_QUERY,
  anilistRequest,
  chunkRows,
  currentSeason,
  dedupeById,
  groupAiringByDay,
  groupByStartMonth,
  matchSeries,
  nextSeasons,
  normaliseAiringSchedules,
  normaliseMedia,
  toFuzzyDateInt,
  toUpcomingItem,
  type AiringDay,
  type AiringScheduleRow,
  type MonthGroup,
  type RawPage,
  type SeriesMatchRow,
  type UpcomingAnimeRow,
  type UpcomingItem,
} from "./upcoming"

export const UPCOMING_CACHE_TAG = "upcoming-anime"
const CACHE_REVALIDATE_SECONDS = 600

type SqlRow = Record<string, unknown>

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

/** Calendar date as YYYY-MM-DD. Postgres drivers hand back either a string or a Date. */
export function isoDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  }
  if (typeof value === "string" && value) {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
  }
  return null
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value === "string" && value) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  return null
}

export function toUpcomingRow(row: SqlRow): UpcomingAnimeRow {
  return {
    anilistId: Number(row.anilist_id),
    malId: num(row.mal_id),
    titleRomaji: str(row.title_romaji),
    titleEnglish: str(row.title_english),
    titleNative: str(row.title_native),
    coverUrl: str(row.cover_url),
    coverColor: str(row.cover_color),
    bannerUrl: str(row.banner_url),
    format: str(row.format),
    status: str(row.status),
    season: str(row.season),
    seasonYear: num(row.season_year),
    startDate: isoDate(row.start_date),
    startYear: num(row.start_year),
    startMonth: num(row.start_month),
    startDay: num(row.start_day),
    episodes: num(row.episodes),
    duration: num(row.duration),
    genres: Array.isArray(row.genres) ? (row.genres as string[]) : [],
    studio: str(row.studio),
    description: str(row.description),
    popularity: num(row.popularity),
    trailerSite: str(row.trailer_site),
    trailerId: str(row.trailer_id),
    source: str(row.source),
    country: str(row.country),
    siteUrl: str(row.site_url),
    nextAiringEpisode: num(row.next_airing_episode),
    nextAiringAt: iso(row.next_airing_at),
    isAdult: row.is_adult === true,
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export type PruneResult = { removedSchedule: number; removedMedia: number }

export type UpcomingStore = {
  upsertMedia(rows: UpcomingAnimeRow[]): Promise<number>
  upsertSchedule(rows: AiringScheduleRow[]): Promise<number>
  prune(now: Date): Promise<PruneResult>
  listSeries(): Promise<SeriesMatchRow[]>
  lastUpdatedAt(): Promise<string | null>
}

async function upsertMediaChunk(rows: UpcomingAnimeRow[]): Promise<number> {
  if (!rows.length) return 0
  const payload = JSON.stringify(
    rows.map((row) => ({
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
    })),
  )

  const result = (await sql`
    INSERT INTO upcoming_anime (
      anilist_id, mal_id, title_romaji, title_english, title_native, cover_url,
      cover_color, banner_url, format, status, season, season_year, start_date,
      start_year, start_month, start_day, episodes, duration, genres, studio,
      description, popularity, trailer_site, trailer_id, source, country, site_url,
      next_airing_episode, next_airing_at, is_adult
    )
    SELECT
      anilist_id, mal_id, title_romaji, title_english, title_native, cover_url,
      cover_color, banner_url, format, status, season, season_year, start_date,
      start_year, start_month, start_day, episodes, duration, genres, studio,
      description, popularity, trailer_site, trailer_id, source, country, site_url,
      next_airing_episode, next_airing_at, is_adult
    FROM jsonb_to_recordset(${payload}::jsonb) AS x(
      anilist_id integer, mal_id integer, title_romaji text, title_english text,
      title_native text, cover_url text, cover_color text, banner_url text,
      format text, status text, season text, season_year integer,
      start_date date, start_year integer, start_month integer, start_day integer,
      episodes integer, duration integer, genres text[], studio text,
      description text, popularity integer, trailer_site text, trailer_id text,
      source text, country text, site_url text, next_airing_episode integer,
      next_airing_at timestamptz, is_adult boolean
    )
    ON CONFLICT (anilist_id) DO UPDATE SET
      mal_id = EXCLUDED.mal_id,
      title_romaji = EXCLUDED.title_romaji,
      title_english = EXCLUDED.title_english,
      title_native = EXCLUDED.title_native,
      cover_url = EXCLUDED.cover_url,
      cover_color = EXCLUDED.cover_color,
      banner_url = EXCLUDED.banner_url,
      format = EXCLUDED.format,
      status = EXCLUDED.status,
      season = EXCLUDED.season,
      season_year = EXCLUDED.season_year,
      start_date = EXCLUDED.start_date,
      start_year = EXCLUDED.start_year,
      start_month = EXCLUDED.start_month,
      start_day = EXCLUDED.start_day,
      episodes = EXCLUDED.episodes,
      duration = EXCLUDED.duration,
      genres = EXCLUDED.genres,
      studio = EXCLUDED.studio,
      description = EXCLUDED.description,
      popularity = EXCLUDED.popularity,
      trailer_site = EXCLUDED.trailer_site,
      trailer_id = EXCLUDED.trailer_id,
      source = EXCLUDED.source,
      country = EXCLUDED.country,
      site_url = EXCLUDED.site_url,
      next_airing_episode = EXCLUDED.next_airing_episode,
      next_airing_at = EXCLUDED.next_airing_at,
      is_adult = EXCLUDED.is_adult,
      fetched_at = now(),
      updated_at = now()
    RETURNING anilist_id
  `) as SqlRow[]

  return result.length
}

async function upsertScheduleChunk(rows: AiringScheduleRow[]): Promise<number> {
  if (!rows.length) return 0
  const payload = JSON.stringify(
    rows.map((row) => ({
      anilist_id: row.anilistId,
      episode: row.episode,
      airing_at: row.airingAt,
    })),
  )

  const result = (await sql`
    INSERT INTO airing_schedule (anilist_id, episode, airing_at)
    SELECT anilist_id, episode, airing_at
    FROM jsonb_to_recordset(${payload}::jsonb) AS x(
      anilist_id integer, episode integer, airing_at timestamptz
    )
    ON CONFLICT (anilist_id, episode) DO UPDATE SET
      airing_at = EXCLUDED.airing_at
    RETURNING anilist_id
  `) as SqlRow[]

  return result.length
}

export const sqlStore: UpcomingStore = {
  async upsertMedia(rows) {
    let written = 0
    for (const chunk of chunkRows(rows, PAGE_SIZE)) {
      written += await upsertMediaChunk(chunk)
    }
    return written
  },

  async upsertSchedule(rows) {
    let written = 0
    for (const chunk of chunkRows(rows, PAGE_SIZE)) {
      written += await upsertScheduleChunk(chunk)
    }
    return written
  },

  async prune(now) {
    const removedSchedule = (await sql`
      DELETE FROM airing_schedule
      WHERE airing_at < ${now.toISOString()}::timestamptz - interval '1 day'
      RETURNING anilist_id
    `) as SqlRow[]

    const removedMedia = (await sql`
      DELETE FROM upcoming_anime
      WHERE status = 'FINISHED'
        AND COALESCE(next_airing_at, updated_at) < ${now.toISOString()}::timestamptz - interval '30 days'
      RETURNING anilist_id
    `) as SqlRow[]

    return { removedSchedule: removedSchedule.length, removedMedia: removedMedia.length }
  },

  async listSeries() {
    const rows = (await sql`
      SELECT id, slug, title, anilist_id
      FROM series
    `) as SqlRow[]

    return rows.map((row) => ({
      id: Number(row.id),
      slug: String(row.slug),
      title: String(row.title),
      anilistId: num(row.anilist_id),
    }))
  },

  async lastUpdatedAt() {
    const rows = (await sql`
      SELECT MAX(fetched_at) AS last_updated FROM upcoming_anime
    `) as SqlRow[]
    return iso(rows[0]?.last_updated)
  },
}

// ---------------------------------------------------------------------------
// Refresh (cron only)
// ---------------------------------------------------------------------------

export type UpcomingRefreshResult = {
  /** Media objects normalised from AniList (adult/no-cover already dropped). */
  fetched: number
  /** `upcoming_anime` rows written, or would be when dry. */
  upserted: number
  /** `airing_schedule` rows written, or would be when dry. */
  schedule: number
  /** Collected titles that also exist in our catalogue. */
  onSite: number
  rateLimited: boolean
  dry: boolean
  written: boolean
  ms: number
  errors: string[]
}

export type UpcomingRefreshOptions = {
  dry?: boolean
  /** Page cap per query (default 3). */
  limit?: number
  now?: Date
  /** Stop starting new requests after this budget. */
  deadlineMs?: number
  store?: UpcomingStore
  request?: typeof anilistRequest
}

const DEFAULT_PAGE_CAP = 3
const MAX_PAGE_CAP = 10
export const DEFAULT_DEADLINE_MS = 45_000

export function clampPageCap(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PAGE_CAP
  return Math.min(MAX_PAGE_CAP, Math.max(1, Math.trunc(limit)))
}

function addMonths(date: Date, months: number): Date {
  const out = new Date(date.getTime())
  const day = out.getUTCDate()
  out.setUTCDate(1)
  out.setUTCMonth(out.getUTCMonth() + months)
  out.setUTCDate(Math.min(day, 28))
  return out
}

/** Unix-second window covering the next SCHEDULE_WINDOW_DAYS days. */
export function scheduleWindow(now: Date): { from: number; to: number } {
  const fromSeconds = Math.floor(now.getTime() / 1000)
  return { from: fromSeconds, to: fromSeconds + SCHEDULE_WINDOW_DAYS * 86_400 }
}

/**
 * Fetches AniList, normalises, and (unless dry) writes the cache tables.
 * Every failure is recorded in `errors`; this function never throws.
 */
export async function refreshUpcoming(
  options: UpcomingRefreshOptions = {},
): Promise<UpcomingRefreshResult> {
  const startedAt = Date.now()
  const now = options.now ?? new Date()
  const dry = options.dry === true
  const store = options.store ?? sqlStore
  const request = options.request ?? anilistRequest
  const deadline = startedAt + (options.deadlineMs ?? DEFAULT_DEADLINE_MS)
  const pageCap = clampPageCap(options.limit)

  const errors: string[] = []
  const collected: UpcomingAnimeRow[] = []
  const scheduleRows: AiringScheduleRow[] = []
  let rateLimited = false

  const expired = () => Date.now() > deadline

  async function fetchPages(
    label: string,
    query: string,
    variables: Record<string, unknown>,
    pages: number,
    extract: (page: NonNullable<RawPage["Page"]>) => {
      media?: UpcomingAnimeRow[]
      schedule?: AiringScheduleRow[]
    },
  ) {
    for (let page = 1; page <= pages; page++) {
      if (page > 1 && expired()) {
        errors.push(`${label}: deadline reached after page ${page - 1}`)
        return
      }

      const result = await request<RawPage>(query, { ...variables, page, perPage: PAGE_SIZE })

      if (!result.ok) {
        if (result.reason === "rate_limited") rateLimited = true
        errors.push(`${label}: ${result.reason}${result.status ? ` (${result.status})` : ""}`)
        return
      }

      const pageData = result.data?.Page
      if (!pageData) {
        errors.push(`${label}: empty page ${page}`)
        return
      }

      const extracted = extract(pageData)
      if (extracted.media?.length) collected.push(...extracted.media)
      if (extracted.schedule?.length) scheduleRows.push(...extracted.schedule)

      if (!pageData.pageInfo?.hasNextPage) return
    }
  }

  // 1. Dated "not yet released" titles inside the 18 month horizon.
  await fetchPages(
    "upcoming",
    UPCOMING_MEDIA_QUERY,
    {
      from: toFuzzyDateInt(now),
      to: toFuzzyDateInt(addMonths(now, UPCOMING_HORIZON_MONTHS)),
    },
    pageCap,
    (page) => ({
      media: (page.media ?? [])
        .map((raw) => normaliseMedia(raw))
        .filter((row): row is UpcomingAnimeRow => row !== null),
    }),
  )

  // 2. TBA titles: a date comparison can never match a null start date, so
  //    undated announcements get a popularity-sorted sweep with a floor.
  await fetchPages("tba", TBA_MEDIA_QUERY, {}, 1, (page) => ({
    media: (page.media ?? [])
      .map((raw) => normaliseMedia(raw))
      .filter(
        (row): row is UpcomingAnimeRow =>
          row !== null && row.startYear === null && (row.popularity ?? 0) >= TBA_POPULARITY_THRESHOLD,
      ),
  }))

  // 3. Currently airing season, for nextAiringEpisode.
  const season = currentSeason(now)
  await fetchPages(
    "releasing",
    RELEASING_MEDIA_QUERY,
    { season: season.season, seasonYear: season.year },
    Math.min(pageCap, 2),
    (page) => ({
      media: (page.media ?? [])
        .map((raw) => normaliseMedia(raw))
        .filter((row): row is UpcomingAnimeRow => row !== null && row.nextAiringAt !== null),
    }),
  )

  // 4. Airing schedule for the next 8 days. airingSchedules cannot filter adult
  //    content, so normaliseAiringSchedules drops it client side.
  const window = scheduleWindow(now)
  await fetchPages("schedule", AIRING_SCHEDULE_QUERY, window, pageCap, (page) => {
    const normalised = normaliseAiringSchedules(page.airingSchedules ?? [])
    return { media: normalised.media, schedule: normalised.schedule }
  })

  const mediaRows = dedupeById(collected)
  const scheduleDeduped: AiringScheduleRow[] = []
  const seenSchedule = new Set<string>()
  for (const row of scheduleRows) {
    const key = `${row.anilistId}:${row.episode}`
    if (seenSchedule.has(key)) continue
    seenSchedule.add(key)
    scheduleDeduped.push(row)
  }

  let onSite = 0
  let written = false
  let upserted = 0
  let scheduleWritten = 0

  const seriesRows = await safely(() => store.listSeries(), [] as SeriesMatchRow[], "series")
  onSite = matchSeries(mediaRows, seriesRows).size

  if (dry) {
    upserted = mediaRows.length
    scheduleWritten = scheduleDeduped.length
  } else if (mediaRows.length || scheduleDeduped.length) {
    try {
      upserted = await store.upsertMedia(mediaRows)
      scheduleWritten = await store.upsertSchedule(scheduleDeduped)
      written = upserted > 0 || scheduleWritten > 0
      await store.prune(now)
    } catch (error) {
      errors.push(`write: ${error instanceof Error ? error.message : "upsert failed"}`)
    }
  }

  return {
    fetched: mediaRows.length,
    upserted,
    schedule: scheduleWritten,
    onSite,
    rateLimited,
    dry,
    written,
    ms: Date.now() - startedAt,
    errors,
  }
}

// ---------------------------------------------------------------------------
// Readers (cache tables only, never throw)
// ---------------------------------------------------------------------------

export type AiringItem = UpcomingItem & { episode: number; airingAt: string }

export type AiringWeekFeed = {
  days: AiringDay<AiringItem>[]
  lastUpdated: string | null
  timeZone: string
}

export type UpcomingFeed = {
  items: UpcomingItem[]
  lastUpdated: string | null
}

export type UpcomingMonthFeed = {
  groups: MonthGroup<UpcomingItem>[]
  lastUpdated: string | null
}

type AiringRow = { row: UpcomingAnimeRow; episode: number; airingAt: string }

const cachedUpcomingMedia = unstable_cache(
  async () => {
    const rows = (await sql`
      SELECT
        anilist_id, mal_id, title_romaji, title_english, title_native, cover_url,
        cover_color, banner_url, format, status, season, season_year, start_date,
        start_year, start_month, start_day, episodes, duration, genres, studio,
        description, popularity, trailer_site, trailer_id, source, country,
        site_url, next_airing_episode, next_airing_at, is_adult
      FROM upcoming_anime
      WHERE is_adult = false
      ORDER BY popularity DESC NULLS LAST, anilist_id ASC
    `) as SqlRow[]
    return rows.map(toUpcomingRow)
  },
  ["upcoming-media"],
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: [UPCOMING_CACHE_TAG] },
)

const cachedAiringWindow = unstable_cache(
  async (fromIso: string, toIso: string) => {
    const rows = (await sql`
      SELECT
        a.anilist_id, a.episode, a.airing_at,
        m.mal_id, m.title_romaji, m.title_english, m.title_native, m.cover_url,
        m.cover_color, m.banner_url, m.format, m.status, m.season, m.season_year,
        m.start_date, m.start_year, m.start_month, m.start_day, m.episodes,
        m.duration, m.genres, m.studio, m.description, m.popularity,
        m.trailer_site, m.trailer_id, m.source, m.country, m.site_url,
        m.next_airing_episode, m.next_airing_at, m.is_adult
      FROM airing_schedule a
      JOIN upcoming_anime m ON m.anilist_id = a.anilist_id
      WHERE a.airing_at >= ${fromIso}::timestamptz
        AND a.airing_at < ${toIso}::timestamptz
        AND m.is_adult = false
      ORDER BY a.airing_at ASC
    `) as SqlRow[]

    return rows.map((row) => ({
      row: toUpcomingRow(row),
      episode: Number(row.episode),
      airingAt: iso(row.airing_at) ?? "",
    }))
  },
  ["upcoming-airing-window"],
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: [UPCOMING_CACHE_TAG] },
)

const cachedSeriesRows = unstable_cache(
  async () => {
    const rows = (await sql`
      SELECT id, slug, title, anilist_id FROM series
    `) as SqlRow[]
    return rows.map((row) => ({
      id: Number(row.id),
      slug: String(row.slug),
      title: String(row.title),
      anilistId: num(row.anilist_id),
    })) as SeriesMatchRow[]
  },
  ["upcoming-series-match"],
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: [UPCOMING_CACHE_TAG] },
)

const cachedLastUpdated = unstable_cache(
  async () => {
    const rows = (await sql`
      SELECT MAX(fetched_at) AS last_updated FROM upcoming_anime
    `) as SqlRow[]
    return iso(rows[0]?.last_updated)
  },
  ["upcoming-last-updated"],
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: [UPCOMING_CACHE_TAG] },
)

async function safely<T>(run: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await run()
  } catch (error) {
    console.error(`[upcoming] ${label} failed`, error)
    return fallback
  }
}

/** The instant local midnight began, in the given IANA zone. */
export function startOfDayInZone(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const year = pick("year")
  const month = pick("month")
  const day = pick("day")
  const hour = pick("hour") % 24
  const minute = pick("minute")
  const second = pick("second")

  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second)
  const offset = wallClock - date.getTime()
  return new Date(Date.UTC(year, month - 1, day) - offset)
}

async function readMatches(rows: UpcomingAnimeRow[]) {
  const seriesRows = await safely(() => cachedSeriesRows(), [] as SeriesMatchRow[], "series")
  return matchSeries(rows, seriesRows)
}

/** Episodes airing over the next 8 days, bucketed into local days. */
export async function getAiringThisWeek(now: Date = new Date()): Promise<AiringWeekFeed> {
  const timeZone = LAGOS_TIME_ZONE
  const from = startOfDayInZone(now, timeZone)
  const to = new Date(from.getTime() + (SCHEDULE_WINDOW_DAYS + 1) * 86_400_000)

  const rows = await safely(
    () => cachedAiringWindow(from.toISOString(), to.toISOString()),
    [] as AiringRow[],
    "airing window",
  )
  const lastUpdated = await safely(cachedLastUpdated, null as string | null, "last updated")

  if (!rows.length) return { days: [], lastUpdated, timeZone }

  const matches = await readMatches(rows.map((entry) => entry.row))
  const items: AiringItem[] = rows.map((entry) => ({
    ...toUpcomingItem(entry.row, matches.get(entry.row.anilistId) ?? null),
    episode: entry.episode,
    airingAt: entry.airingAt,
  }))

  return {
    days: groupAiringByDay(items, (item) => item.airingAt, {
      now,
      timeZone,
      days: SCHEDULE_WINDOW_DAYS,
    }),
    lastUpdated,
    timeZone,
  }
}

/** Titles starting in the next season and the one after it. */
export async function getUpcomingBySeason(now: Date = new Date()): Promise<UpcomingFeed> {
  const rows = await safely(() => cachedUpcomingMedia(), [] as UpcomingAnimeRow[], "upcoming media")
  const lastUpdated = await safely(cachedLastUpdated, null as string | null, "last updated")
  const wanted = new Set(nextSeasons(now, 2).map((entry) => `${entry.year}:${entry.season}`))

  const selected = rows.filter(
    (row) =>
      row.status !== "RELEASING" &&
      row.seasonYear !== null &&
      row.season !== null &&
      wanted.has(`${row.seasonYear}:${row.season}`),
  )

  if (!selected.length) return { items: [], lastUpdated }

  const matches = await readMatches(selected)
  const items = selected
    .map((row) => toUpcomingItem(row, matches.get(row.anilistId) ?? null))
    .sort(byStartDateThenPopularity)

  return { items, lastUpdated }
}

/** Everything further out, grouped by start month (undated titles last). */
export async function getUpcomingFurtherOut(now: Date = new Date()): Promise<UpcomingMonthFeed> {
  const rows = await safely(() => cachedUpcomingMedia(), [] as UpcomingAnimeRow[], "upcoming media")
  const lastUpdated = await safely(cachedLastUpdated, null as string | null, "last updated")
  const wanted = new Set(nextSeasons(now, 2).map((entry) => `${entry.year}:${entry.season}`))

  const selected = rows.filter(
    (row) =>
      row.status !== "RELEASING" &&
      !(row.seasonYear !== null && row.season !== null && wanted.has(`${row.seasonYear}:${row.season}`)),
  )

  if (!selected.length) return { groups: [], lastUpdated }

  const matches = await readMatches(selected)
  const items = selected
    .map((row) => toUpcomingItem(row, matches.get(row.anilistId) ?? null))
    .sort(byStartDateThenPopularity)

  return { groups: groupByStartMonth(items), lastUpdated }
}

/** Upcoming films. */
export async function getUpcomingMovies(): Promise<UpcomingFeed> {
  const rows = await safely(() => cachedUpcomingMedia(), [] as UpcomingAnimeRow[], "upcoming media")
  const lastUpdated = await safely(cachedLastUpdated, null as string | null, "last updated")
  const selected = rows.filter((row) => row.format === "MOVIE" && row.status !== "RELEASING")

  if (!selected.length) return { items: [], lastUpdated }

  const matches = await readMatches(selected)
  const items = selected
    .map((row) => toUpcomingItem(row, matches.get(row.anilistId) ?? null))
    .sort(byStartDateThenPopularity)

  return { items, lastUpdated }
}

/** The next `hours` of episodes, most popular first, for the newsletter. */
export async function getUpcomingForNewsletter(
  hours = 24,
  now: Date = new Date(),
): Promise<AiringItem[]> {
  const until = new Date(now.getTime() + Math.max(1, hours) * 3_600_000)
  const rows = await safely(
    () => cachedAiringWindow(now.toISOString(), until.toISOString()),
    [] as AiringRow[],
    "newsletter window",
  )
  if (!rows.length) return []

  const matches = await readMatches(rows.map((entry) => entry.row))
  return rows
    .map((entry) => ({
      ...toUpcomingItem(entry.row, matches.get(entry.row.anilistId) ?? null),
      episode: entry.episode,
      airingAt: entry.airingAt,
    }))
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
}

/** Newest fetch time, plus the 36 hour staleness verdict. */
export async function getUpcomingCacheState(
  now: Date = new Date(),
): Promise<{ lastUpdated: string | null; stale: boolean }> {
  const lastUpdated = await safely(cachedLastUpdated, null as string | null, "last updated")
  const stamp = lastUpdated ? new Date(lastUpdated).getTime() : Number.NaN
  const stale = Number.isNaN(stamp) || now.getTime() - stamp > STALE_AFTER_HOURS * 3_600_000
  return { lastUpdated, stale }
}

function sortKey(item: UpcomingItem): string {
  if (item.startDateIso) return item.startDateIso
  const year = String(item.startYear ?? 9999).padStart(4, "0")
  const month = String(item.startMonth ?? 12).padStart(2, "0")
  const day = String(item.startDay ?? 28).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function byStartDateThenPopularity(a: UpcomingItem, b: UpcomingItem): number {
  const left = sortKey(a)
  const right = sortKey(b)
  if (left !== right) return left < right ? -1 : 1
  return (b.popularity ?? 0) - (a.popularity ?? 0)
}
