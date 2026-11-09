import { describe, expect, it, vi } from "vitest"
import { asRewritten, computeReadTime, describeSqlError, publishIngestRow } from "./publish"
import { slugifyTitle } from "./slug"
import type { IngestRow, NewsStore } from "./store"

const REWRITTEN = {
  title: "Spy×Family Returns With a Fourth Season and a 2027 Film",
  excerpt: "Both projects were confirmed over the weekend.",
  content: Array.from({ length: 240 }, (_unused, index) => `word${index}`).join(" "),
  tags: ["spy family"],
  category: "News",
}

function row(overrides: Partial<IngestRow> = {}): IngestRow {
  return {
    id: 7,
    guid: "https://www.animenewsnetwork.com/cms/.243614",
    source_url: "https://www.animenewsnetwork.com/news/2026-11-08/spy-family/.243614",
    source_name: "Anime News Network",
    original_title: "Spy×Family Anime Gets 4th Season",
    original_published_at: "2026-11-08T11:00:00.000Z",
    image_url: "https://cdn.animenewsnetwork.com/thumb.jpg",
    topics: ["Anime"],
    status: "rewritten",
    attempts: 1,
    last_error: null,
    rewritten: REWRITTEN,
    post_id: null,
    created_at: "2026-11-08T11:05:00.000Z",
    updated_at: "2026-11-08T11:05:00.000Z",
    ...overrides,
  }
}

function store(overrides: Partial<NewsStore> = {}): NewsStore {
  const base: NewsStore = {
    insertItems: vi.fn(async () => 0),
    listCandidates: vi.fn(async () => []),
    countRemaining: vi.fn(async () => 0),
    getRow: vi.fn(async () => null),
    markRewritten: vi.fn(async () => {}),
    setStatus: vi.fn(async () => {}),
    findPostBySourceUrl: vi.fn(async () => null),
    chooseUniqueSlug: vi.fn(async (slug: string) => slug),
    insertPost: vi.fn(async (input) => ({ id: 42, slug: input.slug })),
    isUniqueViolation: vi.fn(() => false),
    ...overrides,
  }
  return base
}

describe("computeReadTime", () => {
  it("rounds at 200 words per minute with a one minute floor", () => {
    expect(computeReadTime("short")).toBe(1)
    expect(computeReadTime(Array.from({ length: 400 }, () => "word").join(" "))).toBe(2)
    expect(computeReadTime(Array.from({ length: 900 }, () => "word").join(" "))).toBe(5)
  })
})

describe("asRewritten", () => {
  it("requires the stored draft to look like an article", () => {
    expect(asRewritten(row())?.title).toBe(REWRITTEN.title)
    expect(asRewritten(row({ rewritten: null }))).toBeNull()
  })
})

describe("publishIngestRow", () => {
  it("copies the image, keeps provenance and marks the row published", async () => {
    const fake = store()
    const result = await publishIngestRow(row(), { store: fake, copyImage: async () => "https://res.cloudinary.com/x.jpg" })

    expect(result).toMatchObject({
      ok: true,
      postId: 42,
      slug: slugifyTitle(REWRITTEN.title),
      title: REWRITTEN.title,
      coverImage: "https://res.cloudinary.com/x.jpg",
      imageReason: null,
    })
    expect(fake.insertPost).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "News",
        author: "OtakuNaija News",
        coverImage: "https://res.cloudinary.com/x.jpg",
        sourceName: "Anime News Network",
        sourceUrl: row().source_url,
        readTime: 1,
      }),
    )
    expect(fake.setStatus).toHaveBeenCalledWith(7, "published", { postId: 42, error: null })
  })

  it("adopts an existing post for the same source URL instead of duplicating", async () => {
    const fake = store({ findPostBySourceUrl: vi.fn(async () => ({ id: 9, slug: "already-there" })) })
    const result = await publishIngestRow(row(), { store: fake, copyImage: async () => null })

    expect(result).toMatchObject({ ok: true, postId: 9, slug: "already-there", title: REWRITTEN.title })
    expect(fake.insertPost).not.toHaveBeenCalled()
    expect(fake.setStatus).toHaveBeenCalledWith(7, "published", { postId: 9, error: null })
  })

  it("treats a unique violation as an adoption", async () => {
    const fake = store({
      insertPost: vi.fn(async () => {
        throw Object.assign(new Error("duplicate key value"), { code: "23505" })
      }),
      findPostBySourceUrl: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 11, slug: "raced" }),
      isUniqueViolation: vi.fn(() => true),
    })

    const result = await publishIngestRow(row(), { store: fake, copyImage: async () => null })
    expect(result).toMatchObject({ ok: true, postId: 11, slug: "raced", title: REWRITTEN.title })
  })

  it("marks the row failed when the insert fails for another reason", async () => {
    const fake = store({
      insertPost: vi.fn(async () => {
        throw new Error('column "source_url" does not exist')
      }),
    })

    const result = await publishIngestRow(row(), { store: fake, copyImage: async () => null })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("docs/sql/news-automation.sql")
    expect(fake.setStatus).toHaveBeenCalledWith(7, "failed", expect.objectContaining({ attempts: 2 }))
  })

  it("refuses to publish a row that has no rewritten draft", async () => {
    const fake = store()
    const result = await publishIngestRow(row({ rewritten: null }), { store: fake, copyImage: async () => null })
    expect(result).toEqual({ ok: false, error: "no_rewritten_content" })
    expect(fake.insertPost).not.toHaveBeenCalled()
  })
})

describe("describeSqlError", () => {
  it("adds the SQL-file hint only for missing schema", () => {
    expect(describeSqlError(new Error('relation "news_ingest" does not exist'))).toContain("docs/sql/news-automation.sql")
    expect(describeSqlError(new Error("network timeout"))).toBe("network timeout")
  })
})

describe("publishIngestRow cover image", () => {
  const OG = "https://www.animenewsnetwork.com/thumbnails/og-image.jpg"
  const FEED = "https://cdn.animenewsnetwork.com/feed-image.jpg"

  it("prefers the article og:image over the feed image", async () => {
    const inserted: { coverImage: string | null }[] = []
    const localStore = store({
      insertPost: vi.fn(async (input) => {
        inserted.push({ coverImage: input.coverImage })
        return { id: 42, slug: input.slug }
      }),
    })
    const copyImage = vi.fn(async () => ({ url: "https://res.cloudinary.com/demo/cover.jpg" }))

    const result = await publishIngestRow(row({ image_url: FEED }), {
      store: localStore,
      copyImage,
      articleImageUrl: OG,
    })

    expect(result.ok).toBe(true)
    expect(copyImage).toHaveBeenCalledWith(OG)
    expect(inserted[0].coverImage).toBe("https://res.cloudinary.com/demo/cover.jpg")
  })

  it("falls back to the feed image when the article has no og:image", async () => {
    const copyImage = vi.fn(async () => ({ url: "https://res.cloudinary.com/demo/cover.jpg" }))

    const result = await publishIngestRow(row({ image_url: FEED }), {
      store: store(),
      copyImage,
      articleImageUrl: null,
    })

    expect(result.ok).toBe(true)
    expect(copyImage).toHaveBeenCalledWith(FEED)
  })

  it("stores the chosen source URL back on the ingest row", async () => {
    const setImageUrl = vi.fn(async () => {})

    await publishIngestRow(row({ image_url: null }), {
      store: store({ setImageUrl }),
      copyImage: vi.fn(async () => ({ url: "https://res.cloudinary.com/demo/cover.jpg" })),
      articleImageUrl: OG,
    })

    expect(setImageUrl).toHaveBeenCalledWith(7, OG)
  })

  it("publishes without a cover, records the reason, and keeps the remote URL when allowed", async () => {
    const inserted: { coverImage: string | null }[] = []
    const setStatus = vi.fn(async () => {})
    const localStore = store({
      setStatus,
      insertPost: vi.fn(async (input) => {
        inserted.push({ coverImage: input.coverImage })
        return { id: 42, slug: input.slug }
      }),
    })

    const result = await publishIngestRow(row({ image_url: null }), {
      store: localStore,
      copyImage: vi.fn(async () => ({ error: "image_http_403" })),
      articleImageUrl: OG,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.imageReason).toBe("image_http_403")
      expect(result.coverImage).toBe(OG)
    }
    expect(inserted[0].coverImage).toBe(OG)
    const calls = setStatus.mock.calls as unknown as unknown[][]
    const publishedCall = calls.find((call) => call[1] === "published")
    expect(publishedCall?.[2]).toMatchObject({ error: "image_http_403" })
  })

  it("leaves the cover null when the copy fails and the host is not allowed", async () => {
    const inserted: { coverImage: string | null }[] = []
    const localStore = store({
      insertPost: vi.fn(async (input) => {
        inserted.push({ coverImage: input.coverImage })
        return { id: 42, slug: input.slug }
      }),
    })

    await publishIngestRow(row({ image_url: null }), {
      store: localStore,
      copyImage: vi.fn(async () => ({ error: "cloudinary_not_configured" })),
      articleImageUrl: "https://evil.example.com/x.jpg",
    })

    expect(inserted[0].coverImage).toBeNull()
  })
})
