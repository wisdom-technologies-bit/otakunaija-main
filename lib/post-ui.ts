import type { Post } from "./posts"

/** A post is "new" for three hours after it is published. */
export const NEW_POST_WINDOW_HOURS = 3

export function isNewPost(
  publishedAt: string | Date | null | undefined,
  now: number = Date.now(),
  windowHours: number = NEW_POST_WINDOW_HOURS,
): boolean {
  if (!publishedAt) return false
  const time = publishedAt instanceof Date ? publishedAt.getTime() : new Date(publishedAt).getTime()
  if (Number.isNaN(time)) return false
  const age = now - time
  return age >= 0 && age < windowHours * 60 * 60 * 1000
}

export type SeenTracker = {
  has: (id: number) => boolean
  add: (post: Pick<Post, "id">) => boolean
  size: () => number
}

/**
 * Builds the cross-section "seen" set for a page so a post is only ever
 * rendered once. Sections claim posts in reading order.
 */
export function createSeenTracker(initial: Array<Pick<Post, "id">> = []): SeenTracker {
  const ids = new Set<number>()
  for (const post of initial) ids.add(post.id)
  return {
    has: (id) => ids.has(id),
    add: (post) => {
      if (ids.has(post.id)) return false
      ids.add(post.id)
      return true
    },
    size: () => ids.size,
  }
}

/** Removes repeated ids inside one list, keeping the first occurrence. */
export function dedupePosts(posts: Post[]): Post[] {
  const seen = new Set<number>()
  const out: Post[] = []
  for (const post of posts) {
    if (seen.has(post.id)) continue
    seen.add(post.id)
    out.push(post)
  }
  return out
}

/** Returns the posts that have not been used yet, claiming them as used. */
export function pickUnseen(posts: Post[], seen: SeenTracker, limit?: number): Post[] {
  const out: Post[] = []
  for (const post of posts) {
    if (limit !== undefined && out.length >= limit) break
    if (seen.has(post.id)) continue
    seen.add(post)
    out.push(post)
  }
  return out
}

/** `Source: Anime News Network` for auto-published news, otherwise null. */
export function sourceChipLabel(sourceName?: string | null): string | null {
  const name = sourceName?.trim()
  if (!name) return null
  return `Source: ${name}`
}

export type CoverResolution =
  | { kind: "image"; src: string }
  | { kind: "fallback"; category: string }

/**
 * Single source of truth for "does this post have a usable cover".
 * News posts can arrive without an image, and the shared placeholder
 * (with a generated query string) must never be shown.
 */
export function resolveCover(post: Pick<Post, "cover_image" | "category">): CoverResolution {
  const src = post.cover_image?.trim()
  if (src) return { kind: "image", src }
  return { kind: "fallback", category: post.category?.trim() || "Anime" }
}

export type FallbackIcon = "news" | "guides" | "shonen" | "romance" | "action" | "default"

const CATEGORY_VISUALS: Record<string, { icon: FallbackIcon; slug: string }> = {
  news: { icon: "news", slug: "news" },
  guides: { icon: "guides", slug: "guides" },
  shonen: { icon: "shonen", slug: "shonen" },
  romance: { icon: "romance", slug: "romance" },
  action: { icon: "action", slug: "action" },
}

/** The one shared fallback tile: tint + icon per category. */
export function categoryVisual(category?: string | null): {
  icon: FallbackIcon
  className: string
  label: string
} {
  const label = category?.trim() || "Anime"
  const visual = CATEGORY_VISUALS[label.toLowerCase()]
  const slug = visual?.slug ?? "default"
  return {
    icon: visual?.icon ?? "default",
    className: `otk-fallback-${slug}`,
    label,
  }
}
