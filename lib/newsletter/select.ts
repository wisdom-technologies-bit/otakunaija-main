/**
 * Content selection for the daily issue.
 *
 * Pure: no database, no clock, no network. The cron route reads rows, this file
 * decides what belongs in the issue, and the renderers turn that decision into
 * HTML. Every rule here is covered by lib/newsletter/select.test.ts.
 */

import { LAGOS_TIME_ZONE } from "@/lib/format-date"
import { emailImageUrl, GRID, POSTER, siteUrl } from "./images"
import type {
  AiringItem,
  EpisodeItem,
  IssueContent,
  PostItem,
  RawAiring,
  RawEpisode,
  RawPost,
  RawTrendingSeries,
  RawUpcoming,
  ScheduleDay,
  SelectSources,
  SeriesGroup,
  TrendingItem,
  UpcomingItem,
} from "./types"

/** Longest window we will ever cover, in hours. */
export const MAX_WINDOW_HOURS = 36
/** Shortest window, so a manual re-run does not produce an empty issue. */
export const MIN_WINDOW_HOURS = 18
/** Used when there is no previous issue to measure from. */
export const DEFAULT_WINDOW_HOURS = 24

/** How many past issues a post is barred from after appearing. */
export const NO_REPEAT_ISSUES = 3
export const MAX_SECONDARY_POSTS = 5
export const MAX_SERIES_GROUPS = 8
export const MAX_AIRING = 6
export const MAX_TRENDING = 3
export const MAX_UPCOMING = 3
export const MAX_WEEK_IN_REVIEW = 5
export const DEFAULT_MIN_ITEMS = 3

const HOUR = 3_600_000
const DAY = 24 * HOUR

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

export type SelectionWindow = { start: Date; end: Date; hours: number }

/**
 * Since the last sent issue, clamped to [18h, 36h]. A missed cron day therefore
 * catches up rather than silently dropping a day of content, and a double run
 * cannot produce a window that swallows yesterday's issue.
 */
export function selectionWindow(now: Date, lastSentAt: Date | null): SelectionWindow {
  const end = now
  if (!lastSentAt || Number.isNaN(lastSentAt.getTime())) {
    return { start: new Date(end.getTime() - DEFAULT_WINDOW_HOURS * HOUR), end, hours: DEFAULT_WINDOW_HOURS }
  }
  const elapsedHours = (end.getTime() - lastSentAt.getTime()) / HOUR
  const hours = Math.min(MAX_WINDOW_HOURS, Math.max(MIN_WINDOW_HOURS, elapsedHours))
  return { start: new Date(end.getTime() - hours * HOUR), end, hours: Math.round(hours * 10) / 10 }
}

// ---------------------------------------------------------------------------
// Time formatting (WAT = Africa/Lagos, UTC for the schedule table)
// ---------------------------------------------------------------------------

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return {
    hour: pick("hour").padStart(2, "0"),
    minute: pick("minute").padStart(2, "0"),
    weekday: pick("weekday"),
    day: pick("day"),
    month: pick("month"),
  }
}

/** "18:30" in Lagos. */
export function clockInZone(date: Date, timeZone: string): string {
  const { hour, minute } = partsIn(date, timeZone)
  return `${hour}:${minute}`
}

/** "2026-11-09" for the calendar day in Lagos. */
export function dayKeyInZone(date: Date, timeZone = LAGOS_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return `${pick("year")}-${pick("month")}-${pick("day")}`
}

/** "Mon 9 Nov". */
export function dayLabelInZone(date: Date, timeZone = LAGOS_TIME_ZONE): string {
  const { weekday, day, month } = partsIn(date, timeZone)
  return `${weekday} ${Number(day)} ${month}`
}

/** 0 = Sunday … 6 = Saturday, in Lagos. */
export function weekdayInZone(date: Date, timeZone = LAGOS_TIME_ZONE): number {
  const name = partsIn(date, timeZone).weekday
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name)
  return index === -1 ? date.getUTCDay() : index
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Posts that lead an issue need a picture; the rest are ranked by a blend of
 * editorial signal (featured, category) and real readership.
 */
export function postScore(post: RawPost): number {
  const hasImage = post.coverImage && emailImageUrl(post.coverImage, GRID) ? 2 : 0
  const featured = post.featured ? 1.5 : 0
  const views = Math.min((post.views ?? 0) / 400, 3)
  const excerpt = (post.excerpt ?? "").trim().length > 40 ? 0.5 : 0
  return hasImage + featured + views + excerpt
}

function inWindow(value: string | null, window: SelectionWindow): boolean {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return date.getTime() >= window.start.getTime() && date.getTime() <= window.end.getTime()
}

function toPostItem(post: RawPost, baseUrl: string): PostItem {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: (post.excerpt ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
    category: post.category ?? "News",
    coverImage: post.coverImage ?? null,
    imageUrl: emailImageUrl(post.coverImage, GRID),
    url: siteUrl(baseUrl, `/blog/${post.slug}`),
    views: post.views ?? 0,
    publishedAt: post.publishedAt ?? "",
    whyItMatters: null,
  }
}

// ---------------------------------------------------------------------------
// Episodes
// ---------------------------------------------------------------------------

export function groupEpisodes(
  episodes: RawEpisode[],
  baseUrl: string,
  seriesCap = MAX_SERIES_GROUPS,
): SeriesGroup[] {
  const groups = new Map<number, SeriesGroup>()

  for (const episode of episodes) {
    if (episode.adult) continue
    if (!episode.seriesId || !episode.seriesSlug) continue

    const item: EpisodeItem = {
      id: episode.id,
      number: episode.episodeNumber,
      title: (episode.title ?? "").trim() || `Episode ${episode.episodeNumber ?? "?"}`,
      url: siteUrl(
        baseUrl,
        `/episodes/${episode.seriesSlug}/${episode.slug ?? `episode-${episode.episodeNumber ?? episode.id}`}`,
      ),
      publishedAt: episode.publishedAt ?? "",
    }

    const existing = groups.get(episode.seriesId)
    if (existing) {
      existing.episodes.push(item)
      if (!existing.posterUrl) {
        existing.posterUrl = emailImageUrl(episode.seriesPoster ?? episode.thumbnail, POSTER)
      }
      continue
    }

    groups.set(episode.seriesId, {
      seriesId: episode.seriesId,
      slug: episode.seriesSlug,
      title: (episode.seriesTitle ?? "").trim() || "Untitled series",
      url: siteUrl(baseUrl, `/episodes/${episode.seriesSlug}`),
      posterUrl: emailImageUrl(episode.seriesPoster ?? episode.thumbnail, POSTER),
      episodes: [item],
    })
  }

  const list = Array.from(groups.values())
  for (const group of list) {
    group.episodes.sort((a, b) => (b.number ?? 0) - (a.number ?? 0))
  }
  // Freshest drop leads, then the series with more new episodes, then the title
  // so the order is stable between runs.
  list.sort((a, b) => {
    const freshestA = a.episodes[0]?.publishedAt ?? ""
    const freshestB = b.episodes[0]?.publishedAt ?? ""
    if (freshestA !== freshestB) return freshestB.localeCompare(freshestA)
    if (b.episodes.length !== a.episodes.length) return b.episodes.length - a.episodes.length
    return a.title.localeCompare(b.title)
  })

  return list.slice(0, seriesCap)
}

// ---------------------------------------------------------------------------
// Airing schedule
// ---------------------------------------------------------------------------

function toAiringItem(row: RawAiring, now: Date, baseUrl: string, tomorrowKey: string): AiringItem | null {
  if (row.adult) return null
  const at = new Date(row.airingAt)
  if (Number.isNaN(at.getTime())) return null

  const dayKey = dayKeyInZone(at)
  return {
    anilistId: row.anilistId,
    title: row.title,
    episode: row.episode,
    airingAt: at.toISOString(),
    coverUrl: emailImageUrl(row.coverUrl, POSTER),
    url: row.siteUrl ?? siteUrl(baseUrl, `/episodes/upcoming`),
    popularity: row.popularity ?? 0,
    watTime: `${clockInZone(at, LAGOS_TIME_ZONE)} WAT`,
    utcTime: `${clockInZone(at, "UTC")} UTC`,
    dayKey,
    dayLabel: dayKeyInZone(now) === dayKey ? "Today" : tomorrowKey === dayKey ? "Tomorrow" : dayLabelInZone(at),
    isTomorrow: tomorrowKey === dayKey,
  }
}

/**
 * Monday-first buckets for the week-ahead table. Days without anything airing
 * are still returned so the table keeps its shape.
 */
export function buildSchedule(airing: AiringItem[], now: Date): ScheduleDay[] {
  const todayKey = dayKeyInZone(now)
  const today = new Date(`${todayKey}T12:00:00Z`)
  const weekday = weekdayInZone(now)
  const mondayOffset = (weekday + 6) % 7
  const monday = new Date(today.getTime() - mondayOffset * DAY)

  const days: ScheduleDay[] = []
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(monday.getTime() + index * DAY)
    const key = dayKeyInZone(date)
    days.push({
      dayKey: key,
      dayLabel: dayLabelInZone(date),
      weekday: index,
      isToday: key === todayKey,
      items: [],
    })
  }

  for (const item of airing) {
    const day = days.find((entry) => entry.dayKey === item.dayKey)
    if (day && day.items.length < 3) day.items.push(item)
  }

  return days
}

// ---------------------------------------------------------------------------
// Upcoming
// ---------------------------------------------------------------------------

function toUpcomingItem(row: RawUpcoming, baseUrl: string): UpcomingItem {
  const start = row.startDate ? new Date(row.startDate) : null
  const label =
    start && !Number.isNaN(start.getTime())
      ? new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(start)
      : row.season
        ? `${row.season.charAt(0)}${row.season.slice(1).toLowerCase()}${row.seasonYear ? ` ${row.seasonYear}` : ""}`
        : "TBA"

  return {
    anilistId: row.anilistId,
    title: row.title,
    startDate: row.startDate,
    startLabel: label,
    coverUrl: emailImageUrl(row.coverUrl, POSTER),
    url: row.siteUrl ?? siteUrl(baseUrl, "/episodes/upcoming"),
    format: row.format ?? "TV",
  }
}

// ---------------------------------------------------------------------------
// Main selection
// ---------------------------------------------------------------------------

export type SelectInput = {
  now: Date
  lastSentAt: Date | null
  sources: SelectSources
  /** Post ids that appeared in any of the last NO_REPEAT_ISSUES issues. */
  excludePostIds: Iterable<number>
  siteBaseUrl: string
  minItems?: number
}

export function selectIssueContent(input: SelectInput): IssueContent {
  const { now, sources, siteBaseUrl } = input
  const window = selectionWindow(now, input.lastSentAt)
  const minItems = input.minItems ?? DEFAULT_MIN_ITEMS
  const excluded = new Set(input.excludePostIds)

  const todayKey = dayKeyInZone(now)
  const tomorrowKey = dayKeyInZone(new Date(now.getTime() + DAY))
  const weekday = weekdayInZone(now)

  // Posts: inside the window, never from the last three issues, image-led first.
  const rankedPosts = sources.posts
    .filter((post) => inWindow(post.publishedAt, window))
    .filter((post) => !excluded.has(post.id))
    .slice()
    .sort((a, b) => {
      const byScore = postScore(b) - postScore(a)
      if (byScore !== 0) return byScore
      return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
    })

  const allPosts = rankedPosts.map((post) => toPostItem(post, siteBaseUrl))
  const withImage = allPosts.filter((post) => post.imageUrl)
  const topStory = withImage[0] ?? allPosts[0] ?? null
  const secondary = allPosts.filter((post) => post.id !== topStory?.id).slice(0, MAX_SECONDARY_POSTS)

  // Episodes released inside the window, grouped by series.
  const freshEpisodes = sources.episodes
    .filter((episode) => !episode.adult)
    .filter((episode) => inWindow(episode.publishedAt, window))
  const seriesGroups = groupEpisodes(freshEpisodes, siteBaseUrl)
  const episodes = seriesGroups.flatMap((group) => group.episodes)

  // Airing in the next 36 hours, popular first.
  const airing: AiringItem[] = []
  for (const row of sources.airing) {
    const at = new Date(row.airingAt)
    if (Number.isNaN(at.getTime())) continue
    if (at.getTime() < now.getTime() - HOUR) continue
    if (at.getTime() > now.getTime() + 36 * HOUR) continue
    const item = toAiringItem(row, now, siteBaseUrl, tomorrowKey)
    if (item) airing.push(item)
  }
  airing.sort((a, b) => {
    if (b.popularity !== a.popularity) return b.popularity - a.popularity
    return a.airingAt.localeCompare(b.airingAt)
  })
  const topAiring = airing.slice(0, MAX_AIRING)

  // The week table needs the whole week, not just 36 hours.
  const scheduleAiring: AiringItem[] = []
  for (const row of sources.airing) {
    const item = toAiringItem(row, now, siteBaseUrl, tomorrowKey)
    if (item) scheduleAiring.push(item)
  }
  scheduleAiring.sort((a, b) => a.airingAt.localeCompare(b.airingAt))
  const schedule = buildSchedule(scheduleAiring, now)

  // "Upcoming this season" is a Monday/Friday treat, not a daily fixture.
  const seasonDay = weekday === 1 || weekday === 5
  const upcoming: UpcomingItem[] = seasonDay
    ? sources.upcoming
        .filter((row) => !row.adult)
        .slice()
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, MAX_UPCOMING)
        .map((row) => toUpcomingItem(row, siteBaseUrl))
    : []

  const trending: TrendingItem[] = sources.trending.slice(0, MAX_TRENDING).map((row: RawTrendingSeries) => ({
    slug: row.slug,
    title: row.title,
    url: siteUrl(siteBaseUrl, `/episodes/${row.slug}`),
    posterUrl: emailImageUrl(row.poster, POSTER),
    totalViews: Number(row.totalViews ?? 0),
  }))

  // Sunday's week in review: the five most-viewed posts of the last 7 days,
  // which may include posts already used in earlier issues (that is the point).
  const weekInReview: PostItem[] =
    weekday === 0
      ? sources.posts
          .filter((post) => {
            if (!post.publishedAt) return false
            const at = new Date(post.publishedAt).getTime()
            return Number.isFinite(at) && at >= now.getTime() - 7 * DAY && at <= now.getTime()
          })
          .slice()
          .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
          .slice(0, MAX_WEEK_IN_REVIEW)
          .map((post) => toPostItem(post, siteBaseUrl))
      : []

  const counts = {
    posts: allPosts.length,
    episodes: episodes.length,
    series: seriesGroups.length,
    airing: topAiring.length,
    upcoming: upcoming.length,
    trending: trending.length,
  }

  const meaningfulItems = counts.posts + counts.series + counts.airing
  const hasPrimary = counts.posts > 0 || counts.episodes > 0
  const skipped = meaningfulItems < minItems || !hasPrimary

  return {
    windowStart: window.start.toISOString(),
    windowEnd: window.end.toISOString(),
    windowHours: window.hours,
    topStory,
    posts: secondary,
    seriesGroups,
    episodes,
    airing: topAiring,
    schedule,
    upcoming,
    trending,
    weekInReview,
    counts,
    meaningfulItems,
    skipped,
    skipReason: skipped
      ? !hasPrimary
        ? "no-new-posts-or-episodes"
        : `only-${meaningfulItems}-items`
      : null,
  }
}

/** Every post id that must not appear in the next issue. */
export function recentPostIds(payloads: { postIds?: number[] }[], limit = NO_REPEAT_ISSUES): number[] {
  const ids = new Set<number>()
  for (const payload of payloads.slice(0, limit)) {
    for (const id of payload.postIds ?? []) ids.add(id)
  }
  return Array.from(ids)
}

/** Ids a finished issue "used", for the no-repeat rule. */
export function usedPostIds(content: IssueContent): number[] {
  const ids = new Set<number>()
  if (content.topStory) ids.add(content.topStory.id)
  for (const post of content.posts) ids.add(post.id)
  for (const post of content.weekInReview) ids.add(post.id)
  return Array.from(ids)
}
