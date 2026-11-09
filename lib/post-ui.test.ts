import { describe, expect, it } from "vitest"
import {
  NEW_POST_WINDOW_HOURS,
  categoryVisual,
  createSeenTracker,
  dedupePosts,
  isNewPost,
  pickUnseen,
  resolveCover,
} from "./post-ui"
import type { Post } from "./posts"

function post(id: number, overrides: Partial<Post> = {}): Post {
  return {
    id,
    slug: `post-${id}`,
    title: `Post ${id}`,
    excerpt: "excerpt",
    content: "content",
    cover_image: `https://cdn.example.com/${id}.webp`,
    category: "News",
    author: "OtakuNaija",
    tags: null,
    featured: false,
    trending: false,
    views: 0,
    read_time: 3,
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

const HOUR = 60 * 60 * 1000

describe("isNewPost", () => {
  const now = Date.parse("2026-11-08T12:00:00.000Z")

  it("treats a post inside the window as new", () => {
    expect(isNewPost(new Date(now - 2 * HOUR).toISOString(), now)).toBe(true)
    expect(NEW_POST_WINDOW_HOURS).toBe(3)
  })

  it("drops the chip once the window has passed", () => {
    expect(isNewPost(new Date(now - 3 * HOUR).toISOString(), now)).toBe(false)
    expect(isNewPost(new Date(now - 9 * HOUR).toISOString(), now)).toBe(false)
  })

  it("never marks a future or unparseable date as new", () => {
    expect(isNewPost(new Date(now + HOUR).toISOString(), now)).toBe(false)
    expect(isNewPost("not-a-date", now)).toBe(false)
    expect(isNewPost(null, now)).toBe(false)
  })
})

describe("seen tracker", () => {
  it("renders every post at most once across sections", () => {
    const seen = createSeenTracker([post(1)])
    const first = pickUnseen([post(1), post(2), post(3)], seen, 2)
    const second = pickUnseen([post(2), post(3), post(4)], seen)

    expect(first.map((p) => p.id)).toEqual([2, 3])
    expect(second.map((p) => p.id)).toEqual([4])
    expect(seen.size()).toBe(4)
  })

  it("reports duplicates without re-adding them", () => {
    const seen = createSeenTracker()
    expect(seen.add(post(5))).toBe(true)
    expect(seen.add(post(5))).toBe(false)
    expect(seen.has(5)).toBe(true)
    expect(pickUnseen([post(5)], seen)).toHaveLength(0)
  })

  it("dedupes repeated ids inside one list, keeping the first", () => {
    const list = [post(1), post(2), post(1), post(3), post(2)]
    expect(dedupePosts(list).map((p) => p.id)).toEqual([1, 2, 3])
  })
})

describe("resolveCover", () => {
  it("uses the real image when one exists", () => {
    expect(resolveCover(post(1))).toEqual({ kind: "image", src: "https://cdn.example.com/1.webp" })
  })

  it("falls back to the shared tile when the cover is empty", () => {
    expect(resolveCover(post(2, { cover_image: "" }))).toEqual({ kind: "fallback", category: "News" })
    expect(resolveCover(post(3, { cover_image: "   " }))).toEqual({ kind: "fallback", category: "News" })
    expect(resolveCover(post(4, { cover_image: null, category: "Guides" }))).toEqual({
      kind: "fallback",
      category: "Guides",
    })
  })
})

describe("categoryVisual", () => {
  it("maps each category to its own tint and icon", () => {
    expect(categoryVisual("News")).toMatchObject({ icon: "news", className: "otk-fallback-news" })
    expect(categoryVisual("guides")).toMatchObject({ icon: "guides", className: "otk-fallback-guides" })
    expect(categoryVisual("Romance")).toMatchObject({ icon: "romance" })
  })

  it("has a neutral default", () => {
    expect(categoryVisual(undefined)).toMatchObject({ icon: "default", className: "otk-fallback-default" })
    expect(categoryVisual("Light Novel")).toMatchObject({ icon: "default" })
  })
})
