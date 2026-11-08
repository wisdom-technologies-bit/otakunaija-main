import type { FeedItem } from "./ann"

/** ANN <category> values that are unambiguously anime/manga/game coverage. */
export const RELEVANT_TOPICS = new Set([
  "anime",
  "manga",
  "games",
  "game",
  "animation",
  "comics",
  "novels",
  "merch",
  "korean",
])

/**
 * Used only when an item has topics and none of them is in the allowlist, so
 * "Live-Action" / "People" / "Industry" items that are still about an anime
 * adaptation survive.
 */
const TITLE_HINTS = [
  /\banime\b/i,
  /\bmanga\b/i,
  /\bmanhwa\b/i,
  /\bwebtoon\b/i,
  /\blight novel\b/i,
  /\bgame\b/i,
  /\bseason\b/i,
  /\bfilm\b/i,
  /\bmovie\b/i,
  /\bstudio\b/i,
  /\bdub\b/i,
  /\bsub\b/i,
  /\bepisode/i,
  /\bmusic video\b/i,
  /\bop theme\b/i,
  /\bending theme\b/i,
  /\badaptation\b/i,
]

export const DEFAULT_MAX_AGE_HOURS = 72

/**
 * ANN's feed mixes news with reviews, features, interviews and columns. Those
 * are editorial pieces, not news, so they are queued as `skipped` rather than
 * published under the News category with a news byline.
 */
const NOT_NEWS_PATHS = ["/review/", "/feature/", "/interview/", "/column/", "/contest/"]

export function isNewsUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return !NOT_NEWS_PATHS.some((path) => lower.includes(path))
}

export function parseBlockedKeywords(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean)
}

export function isBlockedTitle(title: string, blockedKeywords: string[]): boolean {
  if (!blockedKeywords.length) return false
  const haystack = title.toLowerCase()
  return blockedKeywords.some((keyword) => haystack.includes(keyword))
}

export function isAnimeRelated(item: Pick<FeedItem, "title" | "topics">): boolean {
  const topics = item.topics.map((topic) => topic.trim().toLowerCase()).filter(Boolean)
  if (!topics.length) return true
  if (topics.some((topic) => RELEVANT_TOPICS.has(topic))) return true
  return TITLE_HINTS.some((pattern) => pattern.test(item.title))
}

/** `null` publication dates are treated as fresh: we cannot prove they are old. */
export function isWithinWindow(
  publishedAt: string | null,
  now: Date,
  maxAgeHours = DEFAULT_MAX_AGE_HOURS,
): boolean {
  if (!publishedAt) return true
  const published = new Date(publishedAt)
  if (Number.isNaN(published.getTime())) return true
  const ageMs = now.getTime() - published.getTime()
  if (ageMs < 0) return true
  return ageMs <= maxAgeHours * 60 * 60 * 1000
}

export type FilterReason = "blocked_keyword" | "off_topic" | "not_news"

export type Selection = {
  accepted: FeedItem[]
  /** Older than the window: ignored entirely so the first run is not a backfill. */
  tooOld: FeedItem[]
  /** Queued as `skipped` so the admin can see (and retry) them. */
  filtered: { item: FeedItem; reason: FilterReason }[]
}

/**
 * Decides which feed items are worth queueing: fresh (72h by default, so the
 * first run does not backfill the entire feed), on-topic, not blocklisted.
 * Dedupe by guid keeps the first copy of a repeated guid.
 */
export function selectFeedItems(
  items: FeedItem[],
  options: {
    now: Date
    maxAgeHours?: number
    blockedKeywords?: string[]
    /** guids already present in news_ingest — filtered out before insertion. */
    seen?: Iterable<string>
  },
): Selection {
  const seen = new Set(options.seen ?? [])
  const blocked = options.blockedKeywords ?? []
  const accepted: FeedItem[] = []
  const tooOld: FeedItem[] = []
  const filtered: { item: FeedItem; reason: FilterReason }[] = []
  const acceptedGuids = new Set<string>()

  for (const item of items) {
    if (seen.has(item.guid)) continue
    if (acceptedGuids.has(item.guid)) continue

    if (!isWithinWindow(item.publishedAt, options.now, options.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS)) {
      tooOld.push(item)
      continue
    }
    if (isBlockedTitle(item.title, blocked)) {
      filtered.push({ item, reason: "blocked_keyword" })
      continue
    }
    if (!isAnimeRelated(item)) {
      filtered.push({ item, reason: "off_topic" })
      continue
    }
    if (!isNewsUrl(item.link)) {
      filtered.push({ item, reason: "not_news" })
      continue
    }

    acceptedGuids.add(item.guid)
    accepted.push(item)
  }

  return { accepted, tooOld, filtered }
}
