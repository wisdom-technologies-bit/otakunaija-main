import { describe, expect, it, vi } from "vitest"
import { AUTO_BACKFILL_LIMIT, clampBackfillLimit, backfillMissingCovers } from "./backfill"
import type { ArticleContent } from "./ann"

type Post = { id: number; slug: string; source_url: string }

function storeWith(posts: Post[]) {
  const updates: { id: number; cover: string }[] = []
  return {
    updates,
    store: {
      listPostsMissingCover: vi.fn(async (limit: number) => posts.slice(0, limit)),
      updatePostCover: vi.fn(async (id: number, cover: string) => {
        updates.push({ id, cover })
      }),
    },
  }
}

function article(imageUrl: string | null): { ok: true; data: ArticleContent } {
  return {
    ok: true,
    data: { title: "t", text: "body", imageUrl, publishedAt: null } as unknown as ArticleContent,
  }
}

const POSTS: Post[] = [
  { id: 1, slug: "a", source_url: "https://www.animenewsnetwork.com/news/a/.1" },
  { id: 2, slug: "b", source_url: "https://www.animenewsnetwork.com/news/b/.2" },
]

describe("backfillMissingCovers", () => {
  it("copies the og:image into Cloudinary and updates the post", async () => {
    const { store, updates } = storeWith(POSTS)
    const result = await backfillMissingCovers({
      store,
      fetchArticle: vi.fn(async () => article("https://www.animenewsnetwork.com/og.jpg")),
      copyImage: vi.fn(async () => ({ url: "https://res.cloudinary.com/x/cover.jpg" })),
      revalidate: vi.fn(async () => {}),
    })

    expect(result.checked).toBe(2)
    expect(result.updated).toBe(2)
    expect(result.failed).toBe(0)
    expect(updates).toHaveLength(2)
    expect(updates[0]).toEqual({ id: 1, cover: "https://res.cloudinary.com/x/cover.jpg" })
  })

  it("falls back to the allowed remote og:image when the copy fails", async () => {
    const { store, updates } = storeWith([POSTS[0]])
    const result = await backfillMissingCovers({
      store,
      fetchArticle: vi.fn(async () => article("https://www.animenewsnetwork.com/og.jpg")),
      copyImage: vi.fn(async () => ({ error: "cloudinary_not_configured" as const })),
    })

    expect(updates[0].cover).toBe("https://www.animenewsnetwork.com/og.jpg")
    expect(result.reasons.cloudinary_not_configured).toBe(1)
  })

  it("records a reason and leaves the post alone when there is no usable image", async () => {
    const { store, updates } = storeWith([POSTS[0]])
    const result = await backfillMissingCovers({
      store,
      fetchArticle: vi.fn(async () => article(null)),
      copyImage: vi.fn(async () => ({ error: "no_image" as const })),
    })

    expect(updates).toHaveLength(0)
    expect(result.skipped).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.reasons.no_og_image).toBe(1)
  })

  it("does not touch a disallowed host", async () => {
    const { store, updates } = storeWith([POSTS[0]])
    await backfillMissingCovers({
      store,
      fetchArticle: vi.fn(async () => article("https://evil.example.com/x.jpg")),
      copyImage: vi.fn(async () => ({ error: "image_http_403" as const })),
    })

    expect(updates).toHaveLength(0)
  })

  it("is idempotent: a second pass finds nothing left to do", async () => {
    const { store, updates } = storeWith(POSTS)
    const deps = {
      store,
      fetchArticle: vi.fn(async () => article("https://www.animenewsnetwork.com/og.jpg")),
      copyImage: vi.fn(async () => ({ url: "https://res.cloudinary.com/x/cover.jpg" })),
    }
    await backfillMissingCovers(deps)
    // The fake store still lists the same rows, so a real second run is modelled
    // by handing it an empty result set (what SQL returns once covers exist).
    const second = await backfillMissingCovers({
      ...deps,
      store: { ...store, listPostsMissingCover: vi.fn(async () => []) },
    })

    expect(second.checked).toBe(0)
    expect(second.updated).toBe(0)
    expect(updates).toHaveLength(2)
  })

  it("dry=1 writes nothing but reports what it would do", async () => {
    const { store, updates } = storeWith(POSTS)
    const result = await backfillMissingCovers({
      dry: true,
      store,
      fetchArticle: vi.fn(async () => article("https://www.animenewsnetwork.com/og.jpg")),
      copyImage: vi.fn(async () => ({ url: "https://res.cloudinary.com/x/cover.jpg" })),
    })

    expect(result.dry).toBe(true)
    expect(result.updated).toBe(2)
    expect(updates).toHaveLength(0)
    expect(store.updatePostCover).not.toHaveBeenCalled()
  })

  it("clamps the requested limit", () => {
    expect(clampBackfillLimit(undefined)).toBe(5)
    expect(clampBackfillLimit(0)).toBe(5)
    expect(clampBackfillLimit(Number.NaN)).toBe(5)
    expect(clampBackfillLimit(500)).toBe(25)
    expect(AUTO_BACKFILL_LIMIT).toBe(2)
  })
})
