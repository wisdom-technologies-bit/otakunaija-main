export type ParamValue = string | number | null | undefined
export type QueryParams = Record<string, ParamValue>

/** Values that are implied and therefore omitted from the URL. */
export const DEFAULT_PARAMS: Record<string, string> = {
  status: "all",
  sort: "newest",
  page: "1",
  contentType: "all",
}

/** Changing one of these starts a new result set, so paging restarts. */
export const FILTER_RESET_KEYS: readonly string[] = [
  "status",
  "genre",
  "sort",
  "category",
  "q",
  "contentType",
  "type",
]

function normalize(params: QueryParams): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    out[key] = String(value)
  }
  return out
}

export function hasActiveFilters(
  current: QueryParams,
  defaults: Record<string, string> = DEFAULT_PARAMS,
): boolean {
  return activeFilterChips(current, {}, defaults).length > 0
}

/**
 * Builds a shareable listing URL. Every active parameter is preserved,
 * null/undefined patch values remove a parameter, and any filter change
 * resets `page` so results always start at the top.
 */
export function buildHref(
  basePath: string,
  current: QueryParams,
  patch: QueryParams = {},
  defaults: Record<string, string> = DEFAULT_PARAMS,
): string {
  const merged = normalize(current)
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === "") delete merged[key]
    else merged[key] = String(value)
  }
  if (Object.keys(patch).some((key) => FILTER_RESET_KEYS.includes(key))) delete merged.page
  for (const [key, value] of Object.entries(defaults)) {
    if (merged[key] === value) delete merged[key]
  }
  const query = new URLSearchParams(merged).toString()
  return query ? `${basePath}?${query}` : basePath
}

export function clearFiltersHref(basePath: string): string {
  return basePath
}

export type ActiveFilter = { key: string; label: string; value: string }

export function activeFilterChips(
  current: QueryParams,
  labels: Record<string, string> = {},
  defaults: Record<string, string> = DEFAULT_PARAMS,
): ActiveFilter[] {
  const merged = normalize(current)
  return Object.entries(merged)
    .filter(([key, value]) => FILTER_RESET_KEYS.includes(key) && defaults[key] !== value)
    .map(([key, value]) => ({ key, label: labels[key] ?? key, value }))
}
