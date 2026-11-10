
// TMDB stylised title logos (the transparent wordmarks shown next to a title).
// Server-only by convention: imported by cron routes and server pages only.
//
// Ported from the KumoriTV pipeline, minus Supabase. Everything here is
// optional: without TMDB_API_KEY (v3) or TMDB_READ_ACCESS_TOKEN (v4 bearer)
// every function answers `disabled` and nothing is fetched or logged as an
// error.
//
// The key is never logged, never placed in an error message and never returned
// to a caller. Error strings are fixed on purpose: a thrown fetch error can
// quote the request URL, which for a v3 key contains the secret.

const TMDB_API = "https://api.themoviedb.org/3"
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"

/** Anivexa resolves AniList ids to TMDB/IMDb ids. No title searching, ever. */
function anivexaBase(): string {
  return (process.env.ANIVEXA_BASE_URL || "https://anivexa.otakunaija.name.ng").replace(/\/+$/, "")
}

const REQUEST_TIMEOUT_MS = 8000

/** Sizes we are willing to build a URL for. */
const IMAGE_SIZES = new Set(["w300", "w500", "w780", "original"])

/** `/abc123.png` and nothing else: no host, no traversal, no query. */
const LOGO_PATH = /^\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/

export type TmdbLogo = {
  /** TMDB file path, e.g. `/1abcDEF.png`. */
  path: string
  aspectRatio: number
  width: number
}

export type TmdbLogoResult =
  | { status: "found"; logo: TmdbLogo; media: "tv" | "movie" }
  | { status: "none"; media: "tv" | "movie" | null }
  | { status: "disabled" }
  | { status: "rate_limited"; retryAfterMs: number }
  | { status: "error"; message: string }

/** The ids and hints Anivexa knows about one AniList title. */
export type TmdbIdentity = {
  tmdbId: number | null
  imdbId: string | null
  tvdbId: number | null
  format: string | null
  tmdbSeason: number | null
  media: "tv" | "movie"
}

type TmdbImageEntry = {
  file_path?: unknown
  aspect_ratio?: unknown
  width?: unknown
  height?: unknown
  iso_639_1?: unknown
  vote_average?: unknown
  vote_count?: unknown
}

export function tmdbConfigured(): boolean {
  return Boolean((process.env.TMDB_API_KEY || "").trim() || (process.env.TMDB_READ_ACCESS_TOKEN || "").trim())
}

function parseJsonish(value: unknown): unknown {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function positiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim())
    if (parsed > 0) return parsed
  }
  return null
}

function readKeys(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const candidate = record[key]
    if (candidate !== undefined && candidate !== null && candidate !== "") return candidate
  }
  return null
}

/** Reads `themoviedbId` (or `tmdbId`) out of Anivexa's mappings. Pure. */
export function tmdbIdFromMappings(mappings: unknown): number | null {
  const value = parseJsonish(mappings)
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return positiveInt(readKeys(value as Record<string, unknown>, ["themoviedbId", "tmdbId", "tmdb_id"]))
}

/** `tt1234567` from Anivexa's mappings, or the top level of the payload. */
export function imdbIdFromMappings(mappings: unknown): string | null {
  const value = parseJsonish(mappings)
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = readKeys(value as Record<string, unknown>, ["imdbId", "imdb_id"])
  if (typeof candidate === "string" && /^tt\d{5,}$/.test(candidate.trim())) return candidate.trim()
  return null
}

function languageRank(entry: TmdbImageEntry): number {
  if (entry.iso_639_1 === "en") return 0
  if (entry.iso_639_1 === null || entry.iso_639_1 === undefined) return 1
  return 2
}

function voteOf(entry: TmdbImageEntry): number {
  const value = Number(entry.vote_average)
  return Number.isFinite(value) ? value : 0
}

function voteCountOf(entry: TmdbImageEntry): number {
  const value = Number(entry.vote_count)
  return Number.isFinite(value) ? value : 0
}

/** Language first (en, then no language, then anything), then votes, then width. Pure. */
export function pickBestLogo(logos: unknown): TmdbLogo | null {
  if (!Array.isArray(logos)) return null

  const usable = (logos as TmdbImageEntry[]).filter((entry) => {
    if (!entry || typeof entry !== "object") return false
    if (typeof entry.file_path !== "string" || !LOGO_PATH.test(entry.file_path)) return false

    const aspectRatio = Number(entry.aspect_ratio)
    if (!Number.isFinite(aspectRatio) || aspectRatio < 0.8 || aspectRatio > 8) return false

    const width = Number(entry.width)
    if (!Number.isFinite(width) || width < 200) return false

    return true
  })

  if (!usable.length) return null

  usable.sort((a, b) => {
    const byLanguage = languageRank(a) - languageRank(b)
    if (byLanguage !== 0) return byLanguage

    const byVotes = voteOf(b) - voteOf(a)
    if (byVotes !== 0) return byVotes

    const byVoteCount = voteCountOf(b) - voteCountOf(a)
    if (byVoteCount !== 0) return byVoteCount

    return Number(b.width) - Number(a.width)
  })

  const best = usable[0]

  return {
    path: best.file_path as string,
    aspectRatio: Number(best.aspect_ratio),
    width: Number(best.width),
  }
}

/** Builds a public image URL, or null when the stored path is not a TMDB file. */
export function logoUrl(path: unknown, size = "w500"): string | null {
  if (typeof path !== "string" || !LOGO_PATH.test(path)) return null
  const resolvedSize = IMAGE_SIZES.has(size) ? size : "w500"
  return `${TMDB_IMAGE_BASE}/${resolvedSize}${path}`
}

function authHeaders(): Record<string, string> {
  const token = (process.env.TMDB_READ_ACCESS_TOKEN || "").trim()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** v3 keys travel as a query parameter, v4 tokens as a bearer header. */
function tmdbUrl(path: string, search: Record<string, string>): string {
  const key = (process.env.TMDB_API_KEY || "").trim()
  const token = (process.env.TMDB_READ_ACCESS_TOKEN || "").trim()
  const query = new URLSearchParams(search)
  if (key && !token) query.set("api_key", key)
  const qs = query.toString()
  return `${TMDB_API}${path}${qs ? `?${qs}` : ""}`
}

function retryAfterMs(headers: Headers): number {
  const value = headers.get("retry-after")
  if (value) {
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60 * 60 * 1000)
    const date = Date.parse(value)
    if (Number.isFinite(date)) return Math.max(0, Math.min(date - Date.now(), 60 * 60 * 1000))
  }
  return 5000
}

type JsonResult =
  | { kind: "ok"; json: any }
  | { kind: "missing" }
  | { kind: "rate_limited"; retryAfterMs: number }
  | { kind: "error"; message: string }

async function getJson(url: string): Promise<JsonResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json", ...authHeaders() },
    })

    if (response.status === 404) return { kind: "missing" }
    if (response.status === 429) return { kind: "rate_limited", retryAfterMs: retryAfterMs(response.headers) }
    if (!response.ok) return { kind: "error", message: `TMDB responded ${response.status}` }

    return { kind: "ok", json: await response.json() }
  } catch (error) {
    // Never surface the raw error: it can quote the request URL (and the key).
    const aborted = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
    return { kind: "error", message: aborted ? "TMDB request timed out" : "TMDB request failed" }
  } finally {
    clearTimeout(timer)
  }
}

/** AniList id -> TMDB/IMDb ids, via the Anivexa map endpoint (no title search). */
export async function fetchAnivexaMapping(anilistId: number): Promise<
  { status: "ok"; identity: TmdbIdentity } | { status: "none" } | { status: "error"; message: string }
> {
  if (!Number.isInteger(anilistId) || anilistId <= 0) return { status: "none" }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${anivexaBase()}/map/${anilistId}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })

    if (response.status === 404) return { status: "none" }
    if (!response.ok) return { status: "error", message: `Anivexa responded ${response.status}` }

    const payload = (await response.json()) as Record<string, unknown>
    return { status: "ok", identity: identityFromMapping(payload) }
  } catch (error) {
    const aborted = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
    return { status: "error", message: aborted ? "Anivexa request timed out" : "Anivexa request failed" }
  } finally {
    clearTimeout(timer)
  }
}

/** Normalises one Anivexa payload. Pure, so the shape is unit-tested. */
export function identityFromMapping(payload: unknown): TmdbIdentity {
  const record = (payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {}) as Record<string, unknown>

  const nested = parseJsonish(record.mappings)
  const mappings = (nested && typeof nested === "object" && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : {}) as Record<string, unknown>

  const formatRaw = readKeys(mappings, ["format"]) ?? readKeys(record, ["format"])
  const format = typeof formatRaw === "string" ? formatRaw.toUpperCase() : null
  const media: "tv" | "movie" = format === "MOVIE" ? "movie" : "tv"

  const imdbFromNested = imdbIdFromMappings(mappings)
  const imdbFromTop = imdbIdFromMappings(record)

  return {
    tmdbId: tmdbIdFromMappings(mappings) ?? tmdbIdFromMappings(record),
    imdbId: imdbFromNested ?? imdbFromTop,
    tvdbId: positiveInt(readKeys(mappings, ["thetvdbId", "tvdbId", "tvdb_id"]) ?? readKeys(record, ["thetvdbId", "tvdbId"])),
    format,
    tmdbSeason: positiveInt(
      readKeys(mappings, ["tmdbSeason", "tmdb_season"]) ?? readKeys(record, ["tmdbSeason", "tmdb_season"]),
    ),
    media,
  }
}

/** TMDB id from an IMDb id, when Anivexa only knows the IMDb one. */
export async function findTmdbIdByImdb(
  imdbId: string,
): Promise<{ status: "ok"; tmdbId: number; media: "tv" | "movie" } | { status: "none" } | { status: "error"; message: string } | { status: "rate_limited"; retryAfterMs: number }> {
  if (!/^tt\d{5,}$/.test(imdbId)) return { status: "none" }

  const result = await getJson(tmdbUrl(`/find/${imdbId}`, { external_source: "imdb_id" }))
  if (result.kind === "missing") return { status: "none" }
  if (result.kind === "rate_limited") return { status: "rate_limited", retryAfterMs: result.retryAfterMs }
  if (result.kind === "error") return { status: "error", message: result.message }

  const tv = Array.isArray(result.json?.tv_results) ? result.json.tv_results[0] : null
  if (tv && positiveInt(tv.id)) return { status: "ok", tmdbId: Number(tv.id), media: "tv" }

  const movie = Array.isArray(result.json?.movie_results) ? result.json.movie_results[0] : null
  if (movie && positiveInt(movie.id)) return { status: "ok", tmdbId: Number(movie.id), media: "movie" }

  return { status: "none" }
}

async function requestImages(media: "tv" | "movie", tmdbId: number) {
  const result = await getJson(tmdbUrl(`/${media}/${tmdbId}/images`, { include_image_language: "en,null" }))
  if (result.kind === "ok") return { kind: "ok" as const, logos: result.json?.logos }
  return result
}

/**
 * Finds the best logo for one TMDB id. Movies try `/movie` first, everything
 * else `/tv` first, and a 404 falls through to the other media type once.
 */
export async function fetchLogoFor({
  tmdbId,
  format,
}: {
  tmdbId: number | null | undefined
  format?: string | null
}): Promise<TmdbLogoResult> {
  if (!tmdbConfigured()) return { status: "disabled" }
  if (!tmdbId || !Number.isInteger(tmdbId) || tmdbId <= 0) return { status: "none", media: null }

  const order: Array<"tv" | "movie"> = String(format || "").toUpperCase() === "MOVIE" ? ["movie", "tv"] : ["tv", "movie"]

  for (const media of order) {
    const result = await requestImages(media, tmdbId)

    if (result.kind === "rate_limited") return { status: "rate_limited", retryAfterMs: result.retryAfterMs }
    if (result.kind === "error") return { status: "error", message: result.message }
    if (result.kind === "missing") continue

    const logo = pickBestLogo(result.logos)
    return logo ? { status: "found", logo, media } : { status: "none", media }
  }

  // Unknown on both endpoints: TMDB has nothing for this id.
  return { status: "none", media: null }
}
