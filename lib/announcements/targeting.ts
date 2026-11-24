/**
 * Page targeting for site announcements.
 *
 * Pure functions only (no DB, no React) so the same code runs in the admin UI,
 * in server actions (validation) and in the public client component (matching),
 * and so it can be unit-tested.
 *
 * Target keys (stored in site_announcements.targets):
 *   all                                  every public page
 *   home                                 /
 *   episodes                             /episodes
 *   blog                                 /blog
 *   blog-post:*                          every /blog/<slug>
 *   blog-post:<slug>                     one blog post
 *   series:*                             every /episodes/<series-slug>
 *   series:<series-slug>                 one series page
 *   episode:*                            every /episodes/<series-slug>/<episode-slug>
 *   episode-of:<series-slug>             every episode page of one series
 *   episode:<series-slug>/<episode-slug> one episode page
 *   page:<path>                          any other page; trailing /* = prefix match
 */

export type RouteInfo =
  | { kind: "home" }
  | { kind: "episodes" }
  | { kind: "blog" }
  | { kind: "blog-post"; slug: string }
  | { kind: "series"; seriesSlug: string }
  | { kind: "episode"; seriesSlug: string; episodeSlug: string }
  | { kind: "other"; path: string }
  | { kind: "excluded" }

/** Static children of /episodes that are NOT series slugs. */
const RESERVED_EPISODE_SEGMENTS = new Set(["browse", "movies", "new-releases", "search", "upcoming"])

/** Areas that must never show announcements. */
const EXCLUDED_PREFIXES = ["/admin", "/api"]

const SLUG = "[A-Za-z0-9][A-Za-z0-9_.-]*"
const SLUG_RE = new RegExp(`^${SLUG}$`)
const PAGE_PATH_RE = /^\/[A-Za-z0-9/_.\-]*\*?$/

export function normalizePathname(input: string): string {
  let p = (input || "/").split("?")[0].split("#")[0].trim()
  if (!p.startsWith("/")) p = `/${p}`
  p = p.replace(/\/{2,}/g, "/")
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1)
  try {
    p = decodeURI(p)
  } catch {
    /* keep raw */
  }
  return p.toLowerCase()
}

export function classifyPath(pathname: string): RouteInfo {
  const path = normalizePathname(pathname)
  if (EXCLUDED_PREFIXES.some((x) => path === x || path.startsWith(`${x}/`))) return { kind: "excluded" }
  if (path === "/") return { kind: "home" }
  const seg = path.split("/").filter(Boolean)

  if (seg[0] === "blog") {
    if (seg.length === 1) return { kind: "blog" }
    if (seg.length === 2) return { kind: "blog-post", slug: seg[1] }
    return { kind: "other", path }
  }

  if (seg[0] === "episodes") {
    if (seg.length === 1) return { kind: "episodes" }
    if (RESERVED_EPISODE_SEGMENTS.has(seg[1])) return { kind: "other", path }
    if (seg.length === 2) return { kind: "series", seriesSlug: seg[1] }
    if (seg.length === 3) return { kind: "episode", seriesSlug: seg[1], episodeSlug: seg[2] }
    return { kind: "other", path }
  }

  return { kind: "other", path }
}

function lower(s: string) {
  return s.toLowerCase()
}

function matchesPageTarget(target: string, path: string): boolean {
  const raw = normalizePathname(target)
  if (raw.endsWith("*")) {
    const prefix = raw.slice(0, -1).replace(/\/$/, "")
    return path === prefix || path.startsWith(`${prefix}/`)
  }
  return path === raw
}

export function matchesTarget(route: RouteInfo, pathname: string, target: string): boolean {
  if (route.kind === "excluded") return false
  const path = normalizePathname(pathname)
  if (target === "all") return true

  const colon = target.indexOf(":")
  const head = colon === -1 ? target : target.slice(0, colon)
  const rest = colon === -1 ? "" : target.slice(colon + 1)

  switch (head) {
    case "home":
      return route.kind === "home"
    case "episodes":
      return route.kind === "episodes"
    case "blog":
      return route.kind === "blog"
    case "blog-post":
      return route.kind === "blog-post" && (rest === "*" || lower(rest) === route.slug)
    case "series":
      return route.kind === "series" && (rest === "*" || lower(rest) === route.seriesSlug)
    case "episode-of":
      return route.kind === "episode" && lower(rest) === route.seriesSlug
    case "episode": {
      if (route.kind !== "episode") return false
      if (rest === "*") return true
      return lower(rest) === `${route.seriesSlug}/${route.episodeSlug}`
    }
    case "page":
      return matchesPageTarget(rest, path)
    default:
      return false
  }
}

export function matchesTargets(pathname: string, targets: readonly string[] | null | undefined): boolean {
  if (!targets || targets.length === 0) return false
  const route = classifyPath(pathname)
  if (route.kind === "excluded") return false
  return targets.some((t) => matchesTarget(route, pathname, t))
}

/** Is `key` a well-formed target key? Used by server-side validation. */
export function isValidTargetKey(key: string): boolean {
  if (key.length === 0 || key.length > 300) return false
  if (key === "all" || key === "home" || key === "episodes" || key === "blog") return true
  const colon = key.indexOf(":")
  if (colon === -1) return false
  const head = key.slice(0, colon)
  const rest = key.slice(colon + 1)
  switch (head) {
    case "blog-post":
    case "series":
      return rest === "*" || SLUG_RE.test(rest)
    case "episode-of":
      return SLUG_RE.test(rest)
    case "episode": {
      if (rest === "*") return true
      const parts = rest.split("/")
      return parts.length === 2 && parts.every((p) => SLUG_RE.test(p))
    }
    case "page":
      return PAGE_PATH_RE.test(rest) && !EXCLUDED_PREFIXES.some((x) => rest === x || rest.startsWith(`${x}/`))
    default:
      return false
  }
}

/** Cover-seen bookkeeping key: which "page identity" a cover was seen on. */
export function seenPageKey(pathname: string): string {
  return normalizePathname(pathname)
}

/** The built-in "other pages" shown as checkboxes in the admin. */
export const OTHER_PAGES: ReadonlyArray<{ key: string; label: string }> = [
  { key: "page:/episodes/browse", label: "Browse episodes" },
  { key: "page:/episodes/new-releases", label: "New releases" },
  { key: "page:/episodes/upcoming", label: "Upcoming" },
  { key: "page:/episodes/search", label: "Episode search" },
  { key: "page:/episodes/movies/browse", label: "Movies & specials" },
  { key: "page:/episodes/movies/*", label: "Every movie / special page" },
  { key: "page:/polls", label: "Polls" },
  { key: "page:/polls/*", label: "Every poll page" },
  { key: "page:/about", label: "About" },
  { key: "page:/contact", label: "Contact" },
  { key: "page:/privacy", label: "Privacy" },
  { key: "page:/terms", label: "Terms" },
]

/** Human-readable label for a target key (admin summaries). */
export function describeTarget(key: string): string {
  if (key === "all") return "All pages"
  if (key === "home") return "Home"
  if (key === "episodes") return "Episodes index"
  if (key === "blog") return "Blog index"
  const colon = key.indexOf(":")
  const head = key.slice(0, colon)
  const rest = key.slice(colon + 1)
  switch (head) {
    case "blog-post":
      return rest === "*" ? "All blog posts" : `Blog post: ${rest}`
    case "series":
      return rest === "*" ? "All series pages" : `Series: ${rest}`
    case "episode-of":
      return `All episodes of ${rest}`
    case "episode":
      return rest === "*" ? "All episode pages" : `Episode: ${rest}`
    case "page": {
      const known = OTHER_PAGES.find((p) => p.key === key)
      return known ? known.label : `Page: ${rest}`
    }
    default:
      return key
  }
}
