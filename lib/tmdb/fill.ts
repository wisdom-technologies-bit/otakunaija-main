
// Claim -> fetch -> write for one series' title logo. Shared by the cron job
// Server-only by convention: imported by cron routes and server pages only.
// (app/api/cron/series-logos) and nothing else: this repo has no safe
// background-fill mechanism on render, so pages only ever read.
//
// The row is claimed by stamping `logo_checked_at` first, so two overlapping
// runs can never work on the same series. A claim whose run died before writing
// a result (checked_at set, status null) is retried after an hour.

import { sql } from "@/lib/db"
import { fetchAnivexaMapping, fetchLogoFor, findTmdbIdByImdb, tmdbConfigured } from "./logos"

const DEFAULT_BUDGET_MS = 45_000
export const MAX_BATCH = 60
export const DEFAULT_BATCH = 20

export type SeriesLogoRow = {
  id: number
  anilistId: number | null
  title: string
  format: string | null
  tmdbId: number | null
  tmdbMedia: "tv" | "movie" | null
  tmdbSeason: number | null
  imdbId: string | null
  logoStatus: string | null
  logoCheckedAt: string | null
}

export type SeriesLogoStats = {
  claimed: number
  found: number
  none: number
  errors: number
  skipped: number
  rateLimited: boolean
  remaining: number
  dry: boolean
  retryAfterMs?: number
  ms: number
}

type SqlRow = Record<string, unknown>

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null
}

function toRow(row: SqlRow): SeriesLogoRow {
  const media = str(row.tmdb_media)
  return {
    id: Number(row.id),
    anilistId: num(row.anilist_id),
    title: String(row.title ?? ""),
    format: str(row.format),
    tmdbId: num(row.tmdb_id),
    tmdbMedia: media === "tv" || media === "movie" ? media : null,
    tmdbSeason: num(row.tmdb_season),
    imdbId: str(row.imdb_id),
    logoStatus: str(row.logo_status),
    logoCheckedAt: row.logo_checked_at ? String(row.logo_checked_at) : null,
  }
}

/** The retry windows every candidate query uses. Kept in one place. */
const RETRYABLE = sql`(
  logo_checked_at IS NULL
  OR (logo_status = 'error' AND logo_checked_at < now() - interval '1 hour')
  OR (logo_status IS NULL AND logo_checked_at < now() - interval '1 hour')
  OR (logo_status = 'none' AND logo_checked_at < now() - interval '30 days')
)`

export async function selectLogoWork({
  batch = DEFAULT_BATCH,
  anilistId = null,
  force = false,
}: {
  batch?: number
  anilistId?: number | null
  force?: boolean
} = {}): Promise<SeriesLogoRow[]> {
  const limit = Math.min(MAX_BATCH, Math.max(1, Math.trunc(batch)))
  const rows = (await sql`
    SELECT id, anilist_id, title, format, tmdb_id, tmdb_media, tmdb_season, imdb_id,
           logo_status, logo_checked_at
    FROM series
    WHERE (${anilistId}::int IS NULL OR anilist_id = ${anilistId})
      AND (${force} = true OR logo_path IS NULL)
      AND ${force ? sql`true` : RETRYABLE}
    ORDER BY (logo_checked_at IS NULL) DESC, logo_checked_at ASC NULLS FIRST,
             popularity DESC NULLS LAST, id ASC
    LIMIT ${limit}
  `) as SqlRow[]
  return rows.map(toRow)
}

/**
 * Atomically takes the row. Returns false when another run got there first
 * (or the row is no longer inside its retry window).
 */
export async function claimSeriesLogo(row: SeriesLogoRow, force = false): Promise<boolean> {
  const claimed = (await sql`
    UPDATE series SET logo_checked_at = now()
    WHERE id = ${row.id}
      AND (${force} = true OR ${RETRYABLE})
    RETURNING id
  `) as SqlRow[]
  return claimed.length > 0
}

async function writeResult(id: number, patch: Record<string, unknown>): Promise<void> {
  await sql`
    UPDATE series SET
      tmdb_id = COALESCE(${patch.tmdbId ?? null}::int, tmdb_id),
      tmdb_media = COALESCE(${patch.tmdbMedia ?? null}::text, tmdb_media),
      tmdb_season = COALESCE(${patch.tmdbSeason ?? null}::int, tmdb_season),
      imdb_id = COALESCE(${patch.imdbId ?? null}::text, imdb_id),
      logo_path = ${patch.logoPath ?? null}::text,
      logo_aspect_ratio = ${patch.logoAspectRatio ?? null}::real,
      logo_width = ${patch.logoWidth ?? null}::int,
      logo_status = ${patch.logoStatus ?? null}::text,
      logo_checked_at = now()
    WHERE id = ${id}
  `
}

/** How much work is left in the primary queue (rows never checked). */
export async function remainingLogoWork(): Promise<number> {
  const rows = (await sql`
    SELECT count(*)::int AS remaining
    FROM series
    WHERE logo_path IS NULL AND ${RETRYABLE}
  `) as SqlRow[]
  return num(rows[0]?.remaining) ?? 0
}

export type FillOptions = {
  batch?: number
  anilistId?: number | null
  force?: boolean
  dry?: boolean
  budgetMs?: number
}

/**
 * One cron pass. Never throws for a single series: every failure is counted and
 * stored as `logo_status = 'error'`, retried an hour later.
 */
export async function fillSeriesLogos(options: FillOptions = {}): Promise<SeriesLogoStats> {
  const started = Date.now()
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS
  const dry = options.dry === true
  const stats: SeriesLogoStats = {
    claimed: 0,
    found: 0,
    none: 0,
    errors: 0,
    skipped: 0,
    rateLimited: false,
    remaining: 0,
    dry,
    ms: 0,
  }

  if (!tmdbConfigured()) {
    stats.remaining = await remainingLogoWork().catch(() => 0)
    stats.skipped = 0
    stats.ms = Date.now() - started
    return { ...stats, disabled: true } as SeriesLogoStats & { disabled: boolean }
  }

  const candidates = await selectLogoWork({ batch: options.batch, anilistId: options.anilistId, force: options.force })

  if (dry) {
    // A dry run reports the rows a real pass would claim, and writes nothing.
    stats.claimed = candidates.length
    stats.remaining = await remainingLogoWork().catch(() => 0)
    stats.ms = Date.now() - started
    return stats
  }

  for (const candidate of candidates) {
    if (Date.now() - started > budgetMs) {
      stats.skipped += 1
      break
    }
    if (stats.rateLimited) {
      stats.skipped += 1
      continue
    }

    const claimed = await claimSeriesLogo(candidate, options.force === true)
    if (!claimed) continue
    stats.claimed += 1

    try {
      const result = await resolveLogo(candidate)
      if (result.kind === "rate_limited") {
        // Leave logo_status null: the stale-claim window retries the row in an
        // hour instead of parking it in the 30-day "none" bucket.
        stats.rateLimited = true
        stats.retryAfterMs = result.retryAfterMs
        await writeResult(candidate.id, {})
        continue
      }

      await writeResult(candidate.id, result.patch)
      if (result.kind === "found") stats.found += 1
      else if (result.kind === "none") stats.none += 1
      else stats.errors += 1
    } catch (error) {
      stats.errors += 1
      // Fixed message: a raw error can quote the request URL, key included.
      await writeResult(candidate.id, { logoStatus: "error" }).catch(() => {})
      console.error("[series-logos] lookup failed", { seriesId: candidate.id })
    }
  }

  stats.remaining = await remainingLogoWork().catch(() => 0)
  stats.ms = Date.now() - started
  return stats
}

type ResolveResult =
  | { kind: "found"; patch: Record<string, unknown> }
  | { kind: "none"; patch: Record<string, unknown> }
  | { kind: "error"; patch: Record<string, unknown> }
  | { kind: "rate_limited"; retryAfterMs: number }

/**
 * TMDB id resolution without any title searching:
 *   1. the tmdb_id we already stored,
 *   2. Anivexa's `/map/{anilistId}`,
 *   3. `/find` by the IMDb id Anivexa gave us.
 */
async function resolveLogo(row: SeriesLogoRow): Promise<ResolveResult> {
  let tmdbId = row.tmdbId
  let media = row.tmdbMedia
  let imdbId = row.imdbId
  let tmdbSeason = row.tmdbSeason
  const hints: Record<string, unknown> = {}

  if (!tmdbId && row.anilistId) {
    const mapping = await fetchAnivexaMapping(row.anilistId)
    if (mapping.status === "error") return { kind: "error", patch: { logoStatus: "error" } }
    if (mapping.status === "ok") {
      const identity = mapping.identity
      tmdbId = identity.tmdbId
      media = identity.media
      imdbId = imdbId ?? identity.imdbId
      tmdbSeason = tmdbSeason ?? identity.tmdbSeason
      Object.assign(hints, {
        tmdbId: identity.tmdbId,
        tmdbMedia: identity.media,
        tmdbSeason: identity.tmdbSeason,
        imdbId: identity.imdbId,
      })
    }
  }

  if (!tmdbId && imdbId) {
    const found = await findTmdbIdByImdb(imdbId)
    if (found.status === "rate_limited") return { kind: "rate_limited", retryAfterMs: found.retryAfterMs }
    if (found.status === "error") return { kind: "error", patch: { ...hints, logoStatus: "error" } }
    if (found.status === "ok") {
      tmdbId = found.tmdbId
      media = found.media
      hints.tmdbId = found.tmdbId
      hints.tmdbMedia = found.media
    }
  }

  if (!tmdbId) return { kind: "none", patch: { ...hints, logoStatus: "none" } }

  const result = await fetchLogoFor({ tmdbId, format: row.format })
  if (result.status === "rate_limited") return { kind: "rate_limited", retryAfterMs: result.retryAfterMs }
  if (result.status === "disabled") return { kind: "none", patch: { ...hints, logoStatus: "none" } }
  if (result.status === "error") return { kind: "error", patch: { ...hints, logoStatus: "error" } }
  if (result.status === "none") {
    return { kind: "none", patch: { ...hints, tmdbMedia: result.media ?? media, logoStatus: "none" } }
  }

  return {
    kind: "found",
    patch: {
      ...hints,
      tmdbMedia: result.media,
      logoPath: result.logo.path,
      logoAspectRatio: result.logo.aspectRatio,
      logoWidth: result.logo.width,
      logoStatus: "found",
    },
  }
}
