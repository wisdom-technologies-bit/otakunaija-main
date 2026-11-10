/**
 * Pure presentation helpers for the redesigned /episodes surfaces.
 *
 * Everything here is dependency-free and total: pages, client components and
 * tests all use the same rules for episode ranges, the "new" flag, countdowns,
 * logo fallback, trailer URLs and related-series selection.
 */

export const EPISODE_RANGE_SIZE = 50
export const NEW_EPISODE_WINDOW_HOURS = 72

export type EpisodeRange = {
  index: number
  start: number
  end: number
  /** "1 – 50" / "Ep 12" */
  label: string
}

function positiveInt(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null
}

/**
 * Episode-number windows used by the range selector: 1–50, 51–100, … Never
 * assumes contiguous numbering, only the highest number that exists.
 */
export function episodeRanges(maxEpisode: number, size = EPISODE_RANGE_SIZE): EpisodeRange[] {
  const max = positiveInt(maxEpisode)
  const step = positiveInt(size) ?? EPISODE_RANGE_SIZE
  if (!max) return []

  const ranges: EpisodeRange[] = []
  for (let start = 1; start <= max; start += step) {
    const end = Math.min(start + step - 1, max)
    ranges.push({
      index: ranges.length,
      start,
      end,
      label: start === end ? `Ep ${start}` : `${start} – ${end}`,
    })
  }
  return ranges
}

/** Which range window holds episode `episodeNumber` (0 when it is unknown). */
export function rangeIndexForEpisode(episodeNumber: number, size = EPISODE_RANGE_SIZE): number {
  const n = positiveInt(episodeNumber) ?? 1
  const step = positiveInt(size) ?? EPISODE_RANGE_SIZE
  return Math.floor((n - 1) / step)
}

/** True when the episode sits inside the given window. */
export function episodeInRange(episodeNumber: number, range: EpisodeRange | null | undefined): boolean {
  if (!range) return false
  return episodeNumber >= range.start && episodeNumber <= range.end
}

function toTime(value: string | Date | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

/**
 * The "New" chip rule: the newest published episode, while it is younger than
 * 72 hours. A future-dated episode is not new, and an unparseable date is not
 * new either.
 */
export function isNewEpisode(
  publishedAt: string | Date | number | null | undefined,
  now: number | Date = Date.now(),
  windowHours = NEW_EPISODE_WINDOW_HOURS,
): boolean {
  const published = toTime(publishedAt)
  const current = toTime(now)
  if (published === null || current === null) return false
  const age = current - published
  return age >= 0 && age < windowHours * 60 * 60 * 1000
}

/** The highest episode number in a list, or 0. Tolerates gaps and nulls. */
export function highestEpisodeNumber(
  episodes: Array<{ episodeNumber?: number | null }> | null | undefined,
): number {
  if (!Array.isArray(episodes) || episodes.length === 0) return 0
  return episodes.reduce((max, ep) => {
    const n = Number(ep?.episodeNumber)
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
}

export type CountdownParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalSeconds: number
  expired: boolean
}

/** Split a target instant into countdown parts. `null` when the target is unusable. */
export function countdownParts(
  target: string | Date | number | null | undefined,
  now: number | Date = Date.now(),
): CountdownParts | null {
  const targetTime = toTime(target)
  const currentTime = toTime(now)
  if (targetTime === null || currentTime === null) return null

  const remainingMs = targetTime - currentTime
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000))
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
    expired: remainingMs <= 0,
  }
}

const pad2 = (value: number) => String(value).padStart(2, '0')

/** "12d 04h 09m 51s", dropping leading zero units; "Releasing now" once past. */
export function formatCountdown(parts: CountdownParts | null): string {
  if (!parts) return 'Release date TBA'
  if (parts.expired) return 'Releasing now'
  if (parts.days > 0) return `${parts.days}d ${pad2(parts.hours)}h ${pad2(parts.minutes)}m`
  if (parts.hours > 0) return `${pad2(parts.hours)}h ${pad2(parts.minutes)}m ${pad2(parts.seconds)}s`
  return `${pad2(parts.minutes)}m ${pad2(parts.seconds)}s`
}

/** Up to four labelled tiles for the countdown panel. */
export function countdownTiles(parts: CountdownParts | null): Array<{ label: string; value: string }> {
  if (!parts || parts.expired) return []
  const tiles = [
    { label: 'DAYS', value: String(parts.days) },
    { label: 'HRS', value: pad2(parts.hours) },
    { label: 'MIN', value: pad2(parts.minutes) },
    { label: 'SEC', value: pad2(parts.seconds) },
  ]
  return parts.days > 0 ? tiles : tiles.slice(1)
}

export type LogoState = 'logo' | 'text'

/**
 * Which title treatment to render. A logo needs a usable URL and must not have
 * failed to load; anything else falls back to the text title (never both).
 */
export function logoState(
  logo: { url?: string | null } | string | null | undefined,
  broken = false,
): LogoState {
  if (broken) return 'text'
  const url = typeof logo === 'string' ? logo : logo?.url
  return typeof url === 'string' && url.trim() ? 'logo' : 'text'
}

/** A sane aspect ratio for the logo box, falling back to a wide wordmark. */
export function safeLogoAspect(aspect: unknown, fallback = 3): number {
  const value = Number(aspect)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/** A sane intrinsic width in px for the logo, so the box never collapses. */
export function safeLogoWidth(width: unknown, fallback = 1000): number {
  const value = Number(width)
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback
}

export type TrailerTarget =
  | { kind: 'embed'; provider: 'youtube'; url: string }
  | { kind: 'link'; provider: string; url: string }
  | null

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,32}$/

/**
 * How to show a series trailer. Only YouTube can be embedded, and only through
 * youtube-nocookie; anything else is an outbound link.
 */
export function trailerTarget(
  site: string | null | undefined,
  id: string | null | undefined,
): TrailerTarget {
  if (!site || !id) return null
  const provider = site.trim().toLowerCase()
  const videoId = id.trim()
  if (!videoId) return null

  if (provider === 'youtube') {
    if (!YOUTUBE_ID.test(videoId)) return null
    return { kind: 'embed', provider: 'youtube', url: `https://www.youtube-nocookie.com/embed/${videoId}` }
  }
  if (provider === 'dailymotion') {
    if (!YOUTUBE_ID.test(videoId)) return null
    return { kind: 'link', provider: 'dailymotion', url: `https://www.dailymotion.com/video/${videoId}` }
  }
  return null
}

const splitGenres = (value: string | string[] | null | undefined): string[] => {
  if (Array.isArray(value)) return value.map((g) => String(g).trim()).filter(Boolean)
  if (typeof value !== 'string') return []
  return value
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
}

export type GenreCandidate = {
  slug: string
  genre?: string | string[] | null
  title?: string | null
}

export type GenreSource = {
  slug: string
  genre?: string | string[] | null
}

/**
 * Related series by shared genre, excluding the series you are on. Ties are
 * broken alphabetically so the rail is stable between renders. Series with no
 * shared genre are never returned: a "related" rail of unrelated posters is
 * worse than no rail.
 */
export function selectRelatedSeries<T extends GenreCandidate>(
  self: GenreSource,
  candidates: T[] | null | undefined,
  limit = 6,
): Array<T & { sharedGenres: string[] }> {
  if (!Array.isArray(candidates) || candidates.length === 0) return []

  const own = new Set(splitGenres(self.genre).map((g) => g.toLowerCase()))
  if (own.size === 0) return []

  const scored = candidates
    .filter((candidate) => candidate && candidate.slug && candidate.slug !== self.slug)
    .map((candidate) => {
      const genres = splitGenres(candidate.genre)
      const sharedGenres = genres.filter((g) => own.has(g.toLowerCase()))
      return { candidate, sharedGenres, score: sharedGenres.length }
    })
    .filter((entry) => entry.score > 0)

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (a.candidate.title ?? a.candidate.slug).localeCompare(b.candidate.title ?? b.candidate.slug)
  })

  return scored.slice(0, Math.max(0, limit)).map((entry) => ({
    ...entry.candidate,
    sharedGenres: entry.sharedGenres,
  }))
}

/** "12 episodes" / "Airing" / "Episodes TBA" for the meta row. */
export function episodeCountLabel(count: number | null | undefined, status?: string | null): string {
  const total = positiveInt(count)
  if (total) return `${total} episode${total === 1 ? '' : 's'}`
  if (status === 'upcoming') return 'Episodes TBA'
  return 'Airing'
}
