/**
 * URL state for /episodes/upcoming. Every filter lives in the query string so
 * the page is shareable and back/forward works; changing any filter resets
 * paging, exactly like the rest of the catalogue (lib/listing-url.ts).
 */

export const UPCOMING_BASE = "/episodes/upcoming"

export const UPCOMING_VIEWS = ["week", "season", "later", "movies"] as const
export type UpcomingView = (typeof UPCOMING_VIEWS)[number]

export const UPCOMING_FORMATS = ["all", "TV", "MOVIE", "ONA", "OVA"] as const
export type UpcomingFormat = (typeof UPCOMING_FORMATS)[number]

export const UPCOMING_SORTS = ["soonest", "popular"] as const
export type UpcomingSort = (typeof UPCOMING_SORTS)[number]

export const UPCOMING_PAGE_SIZE = 24

export type UpcomingParams = {
  view: UpcomingView
  format: UpcomingFormat
  genre: string
  sort: UpcomingSort
  onSite: boolean
  page: number
}

export const UPCOMING_DEFAULTS: UpcomingParams = {
  view: "week",
  format: "all",
  genre: "",
  sort: "soonest",
  onSite: false,
  page: 1,
}

export const VIEW_LABELS: Record<UpcomingView, string> = {
  week: "Airing this week",
  season: "Next season",
  later: "Later",
  movies: "Movies",
}

export const FORMAT_OPTIONS: Array<{ value: UpcomingFormat; label: string }> = [
  { value: "all", label: "All" },
  { value: "TV", label: "TV" },
  { value: "MOVIE", label: "Movie" },
  { value: "ONA", label: "ONA" },
  { value: "OVA", label: "OVA" },
]

export const SORT_OPTIONS: Array<{ value: UpcomingSort; label: string }> = [
  { value: "soonest", label: "Soonest" },
  { value: "popular", label: "Most popular" },
]

export const FORMAT_LABELS: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  ONA: "ONA",
  OVA: "OVA",
  SPECIAL: "Special",
  MUSIC: "Music",
}

type RawSearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function isView(value: string | undefined): value is UpcomingView {
  return value !== undefined && (UPCOMING_VIEWS as readonly string[]).includes(value)
}

/** Never throws on junk params: unknown values fall back to the default. */
export function parseUpcomingParams(searchParams: RawSearchParams = {}): UpcomingParams {
  const view = first(searchParams.view)
  const format = first(searchParams.format)
  const sort = first(searchParams.sort)
  const genre = first(searchParams.genre)
  const onSite = first(searchParams.onSite)
  const page = Number.parseInt(first(searchParams.page) ?? "1", 10)

  return {
    view: isView(view) ? view : UPCOMING_DEFAULTS.view,
    format: (UPCOMING_FORMATS as readonly string[]).includes(format ?? "")
      ? (format as UpcomingFormat)
      : UPCOMING_DEFAULTS.format,
    genre: genre?.trim() ?? "",
    sort: (UPCOMING_SORTS as readonly string[]).includes(sort ?? "")
      ? (sort as UpcomingSort)
      : UPCOMING_DEFAULTS.sort,
    onSite: onSite === "1" || onSite === "true",
    page: Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1,
  }
}

/**
 * Builds a URL that keeps every other param. Any change other than `page`
 * restarts paging at 1.
 */
export function buildUpcomingHref(
  current: Partial<UpcomingParams>,
  patch: Partial<UpcomingParams> = {},
): string {
  const merged: UpcomingParams = { ...UPCOMING_DEFAULTS, ...current, ...patch }
  const changesResultSet = Object.keys(patch).some((key) => key !== "page")
  if (changesResultSet) merged.page = 1

  const search = new URLSearchParams()
  if (merged.view !== UPCOMING_DEFAULTS.view) search.set("view", merged.view)
  if (merged.format !== UPCOMING_DEFAULTS.format) search.set("format", merged.format)
  if (merged.genre) search.set("genre", merged.genre)
  if (merged.sort !== UPCOMING_DEFAULTS.sort) search.set("sort", merged.sort)
  if (merged.onSite) search.set("onSite", "1")
  if (merged.page > 1) search.set("page", String(merged.page))

  const query = search.toString()
  return query ? `${UPCOMING_BASE}?${query}` : UPCOMING_BASE
}

/** Keeps the tab, drops every filter, back to page 1. */
export function clearUpcomingFilters(current: Partial<UpcomingParams>): string {
  return buildUpcomingHref(current, {
    format: UPCOMING_DEFAULTS.format,
    genre: "",
    sort: UPCOMING_DEFAULTS.sort,
    onSite: false,
    page: 1,
  })
}

export type UpcomingChip = { key: keyof UpcomingParams; label: string }

/** Removable filter chips. The active tab is not a filter. */
export function upcomingFilterChips(current: Partial<UpcomingParams>): UpcomingChip[] {
  const merged = { ...UPCOMING_DEFAULTS, ...current }
  const chips: UpcomingChip[] = []
  if (merged.format !== "all") {
    chips.push({ key: "format", label: FORMAT_LABELS[merged.format] ?? merged.format })
  }
  if (merged.genre) chips.push({ key: "genre", label: merged.genre })
  if (merged.sort !== "soonest") {
    chips.push({ key: "sort", label: SORT_OPTIONS.find((o) => o.value === merged.sort)?.label ?? merged.sort })
  }
  if (merged.onSite) chips.push({ key: "onSite", label: "On OtakuNaija only" })
  return chips
}

export function hasUpcomingFilters(current: Partial<UpcomingParams>): boolean {
  return upcomingFilterChips(current).length > 0
}

/** Removes one chip: undefined/patch keys reset to their default. */
export function removeUpcomingFilter(
  current: Partial<UpcomingParams>,
  key: keyof UpcomingParams,
): string {
  switch (key) {
    case "format":
      return buildUpcomingHref(current, { format: UPCOMING_DEFAULTS.format })
    case "genre":
      return buildUpcomingHref(current, { genre: "" })
    case "sort":
      return buildUpcomingHref(current, { sort: UPCOMING_DEFAULTS.sort })
    case "onSite":
      return buildUpcomingHref(current, { onSite: false })
    case "view":
      return buildUpcomingHref(current, { view: UPCOMING_DEFAULTS.view })
    default:
      return buildUpcomingHref(current, { page: 1 })
  }
}

// ---------------------------------------------------------------------------
// Filtering (shared by the page and the tests)
// ---------------------------------------------------------------------------

type Filterable = {
  format: string | null
  genres: string[]
  onSite: boolean
  startDateIso: string | null
  startYear: number | null
  startMonth: number | null
  startDay: number | null
  popularity: number | null
}

/** TV includes TV_SHORT, matching how AniList labels short-form series. */
export function matchesFormat(format: string | null, filter: UpcomingFormat): boolean {
  if (filter === "all") return true
  if (filter === "TV") return format === "TV" || format === "TV_SHORT"
  return format === filter
}

export function sortUpcoming<T extends Filterable>(items: T[], sort: UpcomingSort): T[] {
  const key = (item: Filterable) => {
    if (item.startDateIso) return item.startDateIso
    const year = String(item.startYear ?? 9999).padStart(4, "0")
    const month = String(item.startMonth ?? 12).padStart(2, "0")
    const day = String(item.startDay ?? 28).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  return [...items].sort((a, b) => {
    if (sort === "popular") return (b.popularity ?? 0) - (a.popularity ?? 0)
    const left = key(a)
    const right = key(b)
    if (left !== right) return left < right ? -1 : 1
    return (b.popularity ?? 0) - (a.popularity ?? 0)
  })
}

export function filterUpcoming<T extends Filterable>(items: T[], params: UpcomingParams): T[] {
  const filtered = items.filter((item) => {
    if (!matchesFormat(item.format, params.format)) return false
    if (params.genre && !item.genres.some((genre) => genre.toLowerCase() === params.genre.toLowerCase())) {
      return false
    }
    if (params.onSite && !item.onSite) return false
    return true
  })
  return sortUpcoming(filtered, params.sort)
}

export function paginateUpcoming<T>(
  items: T[],
  page: number,
  pageSize = UPCOMING_PAGE_SIZE,
): { items: T[]; page: number; total: number; totalPages: number } {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return { items: items.slice(start, start + pageSize), page: safePage, total, totalPages }
}

/** Every genre present in a list, alphabetical, for the genre select. */
export function collectGenres(items: Array<{ genres: string[] }>): string[] {
  const genres = new Set<string>()
  for (const item of items) for (const genre of item.genres) genres.add(genre)
  return [...genres].sort((a, b) => a.localeCompare(b))
}
