/**
 * Newsletter domain types.
 *
 * `IssueContent` is deliberately HTML-free: it only carries ids, slugs and the
 * metadata a layout needs. That keeps `newsletter_issues.payload` small, lets
 * the selection be unit tested without a renderer, and means the same stored
 * selection can be re-rendered tomorrow with a different template.
 */

export const PREF_KEYS = ["news", "episodes", "upcoming"] as const
export type PrefKey = (typeof PREF_KEYS)[number]

export type Frequency = "daily" | "weekly"

export type NewsletterPrefs = Record<PrefKey, boolean> & { frequency: Frequency }

export const DEFAULT_PREFS: NewsletterPrefs = {
  news: true,
  episodes: true,
  upcoming: true,
  frequency: "daily",
}

/** Parses the jsonb column, tolerating NULLs and half-written objects. */
export function normalisePrefs(raw: unknown): NewsletterPrefs {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const flag = (key: PrefKey) => (typeof record[key] === "boolean" ? (record[key] as boolean) : true)
  const frequency = record.frequency === "weekly" ? "weekly" : "daily"
  return { news: flag("news"), episodes: flag("episodes"), upcoming: flag("upcoming"), frequency }
}

/** Stable key for grouping recipients that receive byte-identical HTML. */
export function prefsKey(prefs: NewsletterPrefs): string {
  return [
    prefs.news ? "n" : "-",
    prefs.episodes ? "e" : "-",
    prefs.upcoming ? "u" : "-",
    prefs.frequency === "weekly" ? "w" : "d",
  ].join("")
}

// ---------------------------------------------------------------------------
// Raw rows, as read from Postgres (before selection)
// ---------------------------------------------------------------------------

export type RawPost = {
  id: number
  slug: string
  title: string
  excerpt: string | null
  category: string | null
  coverImage: string | null
  views: number | null
  featured: boolean | null
  publishedAt: string | null
  sourceName?: string | null
}

export type RawEpisode = {
  id: number
  episodeNumber: number | null
  title: string | null
  slug: string | null
  seriesId: number | null
  seriesSlug: string | null
  seriesTitle: string | null
  seriesPoster: string | null
  thumbnail: string | null
  publishedAt: string | null
  durationSeconds: number | null
  adult: boolean | null
}

export type RawAiring = {
  anilistId: number
  title: string
  episode: number
  airingAt: string
  coverUrl: string | null
  siteUrl: string | null
  popularity: number | null
  adult: boolean | null
}

export type RawUpcoming = {
  anilistId: number
  title: string
  startDate: string | null
  coverUrl: string | null
  siteUrl: string | null
  format: string | null
  seasonYear: number | null
  season: string | null
  popularity: number | null
  adult: boolean | null
}

export type RawTrendingSeries = {
  slug: string
  title: string
  poster: string | null
  totalViews: number | null
}

export type SelectSources = {
  posts: RawPost[]
  episodes: RawEpisode[]
  airing: RawAiring[]
  upcoming: RawUpcoming[]
  trending: RawTrendingSeries[]
}

// ---------------------------------------------------------------------------
// Selection output
// ---------------------------------------------------------------------------

export type PostItem = {
  id: number
  slug: string
  title: string
  excerpt: string
  category: string
  coverImage: string | null
  /** Email-ready URL (Cloudinary-transformed JPG), null when unusable. */
  imageUrl: string | null
  url: string
  views: number
  publishedAt: string
  whyItMatters: string | null
}

export type EpisodeItem = {
  id: number
  number: number | null
  title: string
  url: string
  publishedAt: string
}

export type SeriesGroup = {
  seriesId: number
  slug: string
  title: string
  url: string
  posterUrl: string | null
  episodes: EpisodeItem[]
}

export type AiringItem = {
  anilistId: number
  title: string
  episode: number
  airingAt: string
  coverUrl: string | null
  url: string
  popularity: number
  /** Local (WAT) clock time, pre-formatted so the renderer stays dumb. */
  watTime: string
  utcTime: string
  dayKey: string
  dayLabel: string
  isTomorrow: boolean
}

export type UpcomingItem = {
  anilistId: number
  title: string
  startDate: string | null
  startLabel: string
  coverUrl: string | null
  url: string
  format: string
}

export type ScheduleDay = {
  dayKey: string
  dayLabel: string
  /** 0 = Monday … 6 = Sunday, for the week-ahead table. */
  weekday: number
  isToday: boolean
  items: AiringItem[]
}

export type TrendingItem = {
  slug: string
  title: string
  url: string
  posterUrl: string | null
  totalViews: number
}

export type IssueContent = {
  windowStart: string
  windowEnd: string
  windowHours: number
  topStory: PostItem | null
  posts: PostItem[]
  seriesGroups: SeriesGroup[]
  episodes: EpisodeItem[]
  airing: AiringItem[]
  /** Monday-first week buckets, used by the week-ahead layout. */
  schedule: ScheduleDay[]
  upcoming: UpcomingItem[]
  trending: TrendingItem[]
  weekInReview: PostItem[]
  counts: {
    posts: number
    episodes: number
    series: number
    airing: number
    upcoming: number
    trending: number
  }
  /** Items a reader would consider "something to read or watch". */
  meaningfulItems: number
  skipped: boolean
  skipReason: string | null
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

export type NewsletterCopy = {
  subject: string
  preheader: string
  editorsNote: string
  /** One-line "why it matters" per post id, when the model supplied any. */
  blurbs: Record<string, string>
  generatedBy: "groq" | "fallback" | "admin"
  attempts: number
}

/** A row from `subscribers`, shaped for the flows that read it. */
export type SubscriberRow = {
  id: number
  email: string
  token: string
  status: string
  prefs: NewsletterPrefs
  confirmedAt: string | null
  unsubscribedAt: string | null
  source: string | null
  createdAt: string | null
  lastIssueId: number | null
}
