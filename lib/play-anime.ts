/**
 * Mapping rules for the play service's anime ingest (`POST /api/play/anime`).
 *
 * Kept out of the route so the tricky parts — status transitions and which
 * columns an existing row may have refreshed — are unit-testable without a
 * database. Everything here is pure.
 */

/** Series statuses OtakuNaija knows about. */
export type SeriesStatus = 'ongoing' | 'completed' | 'upcoming'

export type PlayAnimePayload = {
  anilistId: number
  title: string
  status?: unknown
  description?: string | null
  bannerUrl?: string | null
  coverUrl?: string | null
  posterUrl?: string | null
  genres?: unknown
  studioName?: string | null
  releaseYear?: number
  format?: string | null
  startDate?: string | null
  startYear?: number | null
  season?: string | null
  seasonYear?: number | null
  popularity?: number | null
  trailerSite?: string | null
  trailerId?: string | null
  episodesTotal?: number | null
  durationMinutes?: number | null
  source?: string | null
  isPlaceholder?: boolean
}

/** The subset of a `series` row the update rules look at. */
export type SeriesSnapshot = {
  status: string | null
  titleChecked: boolean
  isPlaceholder: boolean
}

/** Columns a refresh may touch. Title is handled separately. */
export type SeriesPatch = {
  title?: string
  synopsis?: string | null
  coverImageUrl?: string | null
  posterImageUrl?: string | null
  genre?: string | null
  status?: string
  isPlaceholder?: boolean
  format?: string | null
  startDate?: string | null
  startYear?: number | null
  startMonth?: number | null
  season?: string | null
  seasonYear?: number | null
  popularity?: number | null
  trailerSite?: string | null
  trailerId?: string | null
  episodesTotal?: number | null
  durationMinutes?: number | null
  source?: string | null
}

/**
 * AniList / play-service status text -> our status column.
 *
 * The legacy mappings are unchanged; `not yet released` used to be flattened to
 * 'ongoing', which is exactly the bug this prompt fixes, so it now maps to
 * 'upcoming' along with the explicit 'upcoming'.
 */
export function mapStatus(rawStatus: unknown): SeriesStatus {
  if (typeof rawStatus !== 'string') return 'ongoing'
  const normalized = rawStatus.trim().toLowerCase().replace(/[_-]+/g, ' ')
  // AniList spellings the play service forwards: RELEASING / FINISHED / NOT_YET_RELEASED.
  if (normalized === 'currently airing' || normalized === 'releasing' || normalized === 'airing' || normalized === 'ongoing') {
    return 'ongoing'
  }
  if (normalized === 'finished airing' || normalized === 'finished' || normalized === 'completed') return 'completed'
  if (normalized === 'upcoming') return 'upcoming'
  if (normalized === 'not yet released') return 'upcoming'
  // Deliberate change: a not-yet-aired title is upcoming, not a live series.
  if (normalized === 'not yet aired') return 'upcoming'
  return 'ongoing'
}

/** True when a payload describes a not-yet-released title. */
export function isUpcomingPayload(body: PlayAnimePayload): boolean {
  return mapStatus(body.status) === 'upcoming' || body.isPlaceholder === true
}

/**
 * The status an existing series may move to, or null for "leave it alone".
 *
 * Only two directions are allowed:
 *   upcoming -> ongoing   (the first episode exists)
 *   ongoing  -> completed (the show ended)
 * Anything -> upcoming is refused, so a re-POST can never demote a live series.
 */
export function nextSeriesStatus(current: string | null, incoming: SeriesStatus): SeriesStatus | null {
  const from = (current ?? 'ongoing') as SeriesStatus
  if (incoming === 'upcoming') return null
  if (from === 'upcoming' && incoming === 'ongoing') return 'ongoing'
  if (from === 'ongoing' && incoming === 'completed') return 'completed'
  return null
}

/** `YYYY-MM-DD` from an ISO string/Date, or null when it is not a real date. */
export function parseStartDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  }
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const iso = `${match[1]}-${match[2]}-${match[3]}`
    const parsed = new Date(`${iso}T00:00:00Z`)
    return Number.isNaN(parsed.getTime()) ? null : iso
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function finiteInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null
  }
  return null
}

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function genresOf(body: PlayAnimePayload): string | null {
  const genres = Array.isArray(body.genres) ? body.genres.filter((g): g is string => typeof g === 'string' && g.trim() !== '') : []
  return genres.length ? genres.join(', ') : null
}

/** The upcoming-release columns, both on create and on refresh. */
function metadataColumns(body: PlayAnimePayload): SeriesPatch {
  const startDate = parseStartDate(body.startDate)
  const patch: SeriesPatch = {}
  const format = clean(body.format)
  if (format) patch.format = format
  if (startDate) {
    patch.startDate = startDate
    patch.startMonth = Number(startDate.slice(5, 7))
    if (body.startYear === undefined || body.startYear === null) {
      patch.startYear = Number(startDate.slice(0, 4))
    }
  }
  const startYear = finiteInt(body.startYear)
  if (startYear !== null) patch.startYear = startYear
  const season = clean(body.season)
  if (season) patch.season = season
  const seasonYear = finiteInt(body.seasonYear)
  if (seasonYear !== null) patch.seasonYear = seasonYear
  const popularity = finiteInt(body.popularity)
  if (popularity !== null) patch.popularity = popularity
  const trailerSite = clean(body.trailerSite)
  if (trailerSite) patch.trailerSite = trailerSite
  const trailerId = clean(body.trailerId)
  if (trailerId) patch.trailerId = trailerId
  const episodesTotal = finiteInt(body.episodesTotal)
  if (episodesTotal !== null) patch.episodesTotal = episodesTotal
  const durationMinutes = finiteInt(body.durationMinutes)
  if (durationMinutes !== null) patch.durationMinutes = durationMinutes
  const source = clean(body.source)
  if (source) patch.source = source
  return patch
}

/** Values for a brand-new series row. */
export function buildCreateValues(body: PlayAnimePayload, creatorId: number, slug: string) {
  const status = mapStatus(body.status)
  const values: SeriesPatch & {
    creatorId: number
    slug: string
    anilistId: number
    title: string
    isPlaceholder: boolean
    createdAt?: Date
  } = {
    creatorId,
    slug,
    anilistId: body.anilistId,
    title: body.title.trim(),
    synopsis: clean(body.description),
    coverImageUrl: clean(body.bannerUrl) ?? clean(body.coverUrl),
    posterImageUrl: clean(body.posterUrl) ?? clean(body.coverUrl),
    status,
    genre: genresOf(body),
    isPlaceholder: body.isPlaceholder === true,
    ...metadataColumns(body),
  }
  if (typeof body.releaseYear === 'number') values.createdAt = new Date(Date.UTC(body.releaseYear, 0, 1))
  return values
}

/**
 * The refresh patch for a series that already exists.
 *
 * Metadata is re-applied (AniList keeps correcting titles and artwork), but:
 *  - `title` is only refreshed while `title_checked` is false, so an editor's
 *    corrected title is never overwritten;
 *  - the status only moves in the allowed directions;
 *  - a placeholder flag clears the moment the series goes live.
 */
export function buildUpdatePatch(
  existing: SeriesSnapshot,
  body: PlayAnimePayload,
): { patch: SeriesPatch; statusChanged: boolean; becameOngoing: boolean } {
  const patch: SeriesPatch = {}
  if (!existing.titleChecked) patch.title = body.title.trim()

  const synopsis = clean(body.description)
  if (synopsis) patch.synopsis = synopsis
  const cover = clean(body.bannerUrl) ?? clean(body.coverUrl)
  if (cover) patch.coverImageUrl = cover
  const poster = clean(body.posterUrl) ?? clean(body.coverUrl)
  if (poster) patch.posterImageUrl = poster
  const genres = genresOf(body)
  if (genres) patch.genre = genres

  Object.assign(patch, metadataColumns(body))

  const incoming = mapStatus(body.status)
  const allowed = nextSeriesStatus(existing.status, incoming)
  if (allowed) patch.status = allowed
  // A series that is now airing is no longer a placeholder.
  if (allowed === 'ongoing') patch.isPlaceholder = false

  const becameOngoing = (existing.status ?? 'ongoing') !== 'ongoing' && (patch.status ?? existing.status) === 'ongoing'
  return { patch, statusChanged: allowed !== null, becameOngoing }
}

/** True when an ingest result must announce new content. Never for placeholders. */
export function shouldEnqueuePush(status: string | null, isPlaceholder: boolean): boolean {
  return status === 'ongoing' && !isPlaceholder
}
