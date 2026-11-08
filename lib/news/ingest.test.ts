import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ArticleContent, FeedItem } from "./ann"
import { runNewsIngest, readConfig } from "./ingest"
import type { RewrittenArticle, RewriteOutcome } from "./rewrite"
import type {
  IngestRow,
  IngestStatus,
  NewIngestItem,
  NewPostInput,
  NewsStore,
  StatusPatch,
} from "./store"

/** In-memory NewsStore so the pipeline can be exercised without a database. */
class MemoryStore implements NewsStore {
  rows: IngestRow[] = []
  posts: (NewPostInput & { id: number })[] = []
  writes = 0
  private sequence = 0

  private nextId() {
    this.sequence += 1
    return this.sequence
  }

  async insertItems(items: NewIngestItem[]) {
    let inserted = 0
    for (const item of items) {
      if (this.rows.some((row) => row.guid === item.guid)) continue
      const now = new Date().toISOString()
      this.rows.push({
        id: this.nextId(),
        guid: item.guid,
        source_url: item.sourceUrl,
        source_name: item.sourceName ?? "Anime News Network",
        original_title: item.title,
        original_published_at: item.publishedAt,
        image_url: item.imageUrl,
        topics: item.topics,
        status: item.status ?? "pending",
        attempts: 0,
        last_error: item.lastError ?? null,
        rewritten: null,
        post_id: null,
        created_at: now,
        updated_at: now,
      })
      inserted += 1
    }
    if (inserted) this.writes += 1
    return inserted
  }

  async listCandidates({ limit, includeRewritten, forceGuid }: { limit: number; includeRewritten: boolean; forceGuid?: string | null }) {
    const candidates = this.rows.filter((row) => {
      if (forceGuid) return row.guid === forceGuid && row.status !== "published"
      if (row.status === "pending") return true
      if (row.status === "failed") return row.attempts < 3
      if (row.status === "rewritten") return includeRewritten
      return false
    })
    return candidates.slice(0, limit)
  }

  async countRemaining({ includeRewritten }: { includeRewritten: boolean }) {
    return this.rows.filter(
      (row) =>
        row.status === "pending" ||
        (row.status === "failed" && row.attempts < 3) ||
        (row.status === "rewritten" && includeRewritten),
    ).length
  }

  async getRow(id: number) {
    return this.rows.find((row) => row.id === id) ?? null
  }

  async markRewritten(id: number, rewritten: RewrittenArticle, attempts: number) {
    const row = this.rows.find((entry) => entry.id === id)
    if (!row) return
    row.status = "rewritten"
    row.rewritten = rewritten
    row.attempts = attempts
    row.last_error = null
    row.updated_at = new Date().toISOString()
    this.writes += 1
  }

  async setStatus(id: number, status: IngestStatus, patch: StatusPatch = {}) {
    const row = this.rows.find((entry) => entry.id === id)
    if (!row) return
    row.status = status
    if (patch.attempts !== undefined) row.attempts = patch.attempts
    if (Object.prototype.hasOwnProperty.call(patch, "error")) row.last_error = patch.error ?? null
    if (patch.postId) row.post_id = patch.postId
    row.updated_at = new Date().toISOString()
    this.writes += 1
  }

  async findPostBySourceUrl(sourceUrl: string) {
    const post = this.posts.find((entry) => entry.sourceUrl === sourceUrl)
    return post ? { id: post.id, slug: post.slug } : null
  }

  async chooseUniqueSlug(base: string) {
    const taken = new Set(this.posts.map((post) => post.slug))
    if (!taken.has(base)) return base
    let counter = 2
    while (taken.has(`${base}-${counter}`)) counter += 1
    return `${base}-${counter}`
  }

  async insertPost(input: NewPostInput) {
    if (this.posts.some((post) => post.sourceUrl === input.sourceUrl)) {
      const error = new Error("duplicate key value violates unique constraint") as Error & { code: string }
      error.code = "23505"
      throw error
    }
    const post = { ...input, id: 100 + this.posts.length + 1 }
    this.posts.push(post)
    this.writes += 1
    return { id: post.id, slug: post.slug }
  }

  isUniqueViolation(error: unknown) {
    return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "23505")
  }
}

const NOW = new Date("2026-11-08T12:00:00.000Z")

const FEED_ITEM: FeedItem = {
  guid: "https://www.animenewsnetwork.com/cms/.243614",
  title: "Spy×Family Anime Gets 4th Season, Theatrical Film in 2027",
  link: "https://www.animenewsnetwork.com/news/2026-11-08/spy-family/.243614",
  description: "Visual revealed for new season",
  publishedAt: "2026-11-08T11:00:00.000Z",
  topics: ["Anime"],
  imageUrl: "https://cdn.animenewsnetwork.com/thumb.jpg",
}

const ARTICLE: ArticleContent = {
  url: FEED_ITEM.link,
  title: FEED_ITEM.title,
  imageUrl: FEED_ITEM.imageUrl,
  paragraphs: ["first", "second"],
  text: "The staff announced the fourth season and a new film in 2027.",
}

const REWRITE: RewrittenArticle = {
  title: "Spy×Family Returns With a Fourth Season and a 2027 Film",
  excerpt: "A new season and a feature film are on the way.",
  content: Array.from({ length: 200 }, (_unused, index) => `word${index}`).join(" "),
  tags: ["spy family", "anime"],
  category: "News",
}

function makeDeps(overrides: Partial<Parameters<typeof runNewsIngest>[1]> = {}) {
  const store = new MemoryStore()
  const fetchFeed = vi.fn(async () => ({ ok: true as const, data: { items: [FEED_ITEM] } }))
  const fetchArticle = vi.fn(async () => ({ ok: true as const, data: ARTICLE }))
  const rewrite = vi.fn(async (): Promise<RewriteOutcome> => ({ ok: true, data: REWRITE }))
  const copyImage = vi.fn(async () => "https://res.cloudinary.com/demo/image/upload/news.jpg")
  const push = vi.fn(async () => {})

  return {
    store,
    deps: {
      store,
      fetchFeed,
      fetchArticle,
      rewrite,
      copyImage,
      push,
      now: () => NOW,
      ...overrides,
    },
  }
}

beforeEach(() => {
  vi.stubEnv("NEWS_AUTOPUBLISH", "")
  vi.stubEnv("NEWS_PUSH", "")
  vi.stubEnv("NEWS_BLOCKED_KEYWORDS", "")
  vi.stubEnv("NEWS_MAX_PER_RUN", "")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("readConfig", () => {
  it("defaults to 3 items per run, auto-publish on and push off", () => {
    const config = readConfig()
    expect(config.limit).toBe(3)
    expect(config.autopublish).toBe(true)
    expect(config.pushEnabled).toBe(false)
    expect(config.blockedKeywords).toEqual([])
  })

  it("clamps the limit to 1…10 and only accepts the literal true", () => {
    vi.stubEnv("NEWS_AUTOPUBLISH", "yes")
    vi.stubEnv("NEWS_MAX_PER_RUN", "99")
    expect(readConfig().limit).toBe(10)
    expect(readConfig().autopublish).toBe(false)
    vi.stubEnv("NEWS_MAX_PER_RUN", "0")
    expect(readConfig().limit).toBe(1)
  })
})

describe("runNewsIngest", () => {
  it("publishes one rewritten story end to end", async () => {
    const { store, deps } = makeDeps()
    const result = await runNewsIngest({}, deps)

    expect(result).toMatchObject({ fetched: 1, new: 1, rewritten: 1, published: 1, failed: 0, skipped: 0, dry: false })
    expect(result.error).toBeUndefined()

    expect(store.posts).toHaveLength(1)
    const [post] = store.posts
    expect(post.category).toBe("News")
    expect(post.author).toBe("OtakuNaija News")
    expect(post.sourceName).toBe("Anime News Network")
    expect(post.sourceUrl).toBe(FEED_ITEM.link)
    expect(post.coverImage).toBe("https://res.cloudinary.com/demo/image/upload/news.jpg")
    expect(post.slug).toBe("spy-family-returns-with-a-fourth-season-and-a-2027-film")
    expect(post.readTime).toBeGreaterThanOrEqual(1)

    expect(store.rows[0]).toMatchObject({ status: "published", post_id: post.id })
    expect(result.remaining).toBe(0)
  })

  it("is idempotent: a second run never duplicates the post or the queue row", async () => {
    const { store, deps } = makeDeps()
    await runNewsIngest({}, deps)
    const second = await runNewsIngest({}, deps)

    expect(store.posts).toHaveLength(1)
    expect(store.rows).toHaveLength(1)
    expect(second).toMatchObject({ fetched: 1, new: 0, published: 0, rewritten: 0, failed: 0 })
  })

  it("performs no writes when dry=1", async () => {
    const { store, deps } = makeDeps()
    const result = await runNewsIngest({ dry: true }, deps)

    expect(result.dry).toBe(true)
    expect(store.writes).toBe(0)
    expect(store.rows).toHaveLength(0)
    expect(store.posts).toHaveLength(0)
    expect(deps.fetchArticle).not.toHaveBeenCalled()
    expect(deps.rewrite).not.toHaveBeenCalled()
    expect(result.plan?.map((entry) => entry.action)).toEqual(["insert_pending"])
    expect(result.plan?.[0].title).toBe(FEED_ITEM.title)
  })

  it("parks rows as rewritten when NEWS_AUTOPUBLISH is not true", async () => {
    vi.stubEnv("NEWS_AUTOPUBLISH", "false")
    const { store, deps } = makeDeps()

    const result = await runNewsIngest({}, deps)
    expect(result).toMatchObject({ rewritten: 1, published: 0 })
    expect(store.rows[0].status).toBe("rewritten")
    expect(store.rows[0].rewritten?.title).toBe(REWRITE.title)
    expect(store.posts).toHaveLength(0)

    // Rewritten rows wait for the admin instead of being rewritten again.
    const second = await runNewsIngest({}, deps)
    expect(second.rewritten).toBe(0)
    expect(deps.rewrite).toHaveBeenCalledTimes(1)
  })

  it("queues blocklisted titles as skipped without fetching the article", async () => {
    vi.stubEnv("NEWS_BLOCKED_KEYWORDS", "pachinko")
    const { store, deps } = makeDeps({
      fetchFeed: vi.fn(async () => ({
        ok: true as const,
        data: { items: [{ ...FEED_ITEM, title: "New Pachinko Machine Unveiled" }] },
      })),
    })

    const result = await runNewsIngest({}, deps)
    expect(result).toMatchObject({ fetched: 1, new: 0, skipped: 1, rewritten: 0, published: 0 })
    expect(store.rows[0]).toMatchObject({ status: "skipped", last_error: "filtered:blocked_keyword" })
    expect(deps.fetchArticle).not.toHaveBeenCalled()
  })

  it("ignores feed items older than 72 hours on the first run", async () => {
    const { store, deps } = makeDeps({
      fetchFeed: vi.fn(async () => ({
        ok: true as const,
        data: { items: [{ ...FEED_ITEM, guid: "old", publishedAt: "2026-10-01T00:00:00.000Z" }] },
      })),
    })

    const result = await runNewsIngest({}, deps)
    expect(result).toMatchObject({ fetched: 1, new: 0, skipped: 1 })
    expect(store.rows).toHaveLength(0)
  })

  it("reports a feed failure without writing anything", async () => {
    const { store, deps } = makeDeps({ fetchFeed: vi.fn(async () => ({ ok: false as const, error: "feed_http_503" })) })

    const result = await runNewsIngest({}, deps)
    expect(result.error).toBe("feed_http_503")
    expect(result.fetched).toBe(0)
    expect(store.writes).toBe(0)
  })

  it("keeps rate-limited rewrites pending instead of failing them", async () => {
    const { store, deps } = makeDeps({
      rewrite: vi.fn(async (): Promise<RewriteOutcome> => ({ ok: false, reason: "groq_http_429", deferred: true })),
    })

    const result = await runNewsIngest({}, deps)
    expect(result).toMatchObject({ failed: 0, published: 0, rewritten: 0 })
    expect(store.rows[0].status).toBe("pending")
    expect(store.rows[0].last_error).toContain("deferred")
    expect(result.remaining).toBe(1)
  })

  it("marks a rejected rewrite as failed with the reason and never publishes it", async () => {
    const { store, deps } = makeDeps({
      rewrite: vi.fn(async (): Promise<RewriteOutcome> => ({
        ok: false,
        reason: "verbatim_overlap:the series is receiving",
        deferred: false,
      })),
    })

    const result = await runNewsIngest({}, deps)
    expect(result).toMatchObject({ failed: 1, published: 0 })
    expect(store.rows[0].status).toBe("failed")
    expect(store.rows[0].attempts).toBe(1)
    expect(store.rows[0].last_error).toContain("rewrite_rejected")
    expect(store.posts).toHaveLength(0)
  })

  it("fails the row when the article page cannot be read", async () => {
    const { store, deps } = makeDeps({
      fetchArticle: vi.fn(async () => ({ ok: false as const, error: "article_http_404" })),
    })

    const result = await runNewsIngest({}, deps)
    expect(result.failed).toBe(1)
    expect(store.rows[0].status).toBe("failed")
    expect(store.rows[0].last_error).toContain("article_fetch_failed")
  })

  it("falls back to the placeholder when the cover image cannot be copied", async () => {
    const { store, deps } = makeDeps({
      copyImage: vi.fn(async () => {
        throw new Error("image_http_403")
      }),
    })

    const result = await runNewsIngest({}, deps)
    expect(result.published).toBe(1)
    expect(store.posts[0].coverImage).toBeNull()
  })

  it("stops at the per-run limit", async () => {
    const items = Array.from({ length: 5 }, (_unused, index) => ({
      ...FEED_ITEM,
      guid: `guid-${index}`,
      link: `${FEED_ITEM.link}-${index}`,
      title: `Anime Story Number ${index}`,
    }))
    const { store, deps } = makeDeps({ fetchFeed: vi.fn(async () => ({ ok: true as const, data: { items } })) })

    const result = await runNewsIngest({ limit: 2 }, deps)
    expect(result.new).toBe(5)
    expect(result.published).toBe(2)
    expect(store.posts).toHaveLength(2)
    expect(result.remaining).toBe(3)
  })

  it("sends at most one push per run and only when NEWS_PUSH is true", async () => {
    vi.stubEnv("NEWS_PUSH", "true")
    const items = [
      { ...FEED_ITEM, guid: "a", link: `${FEED_ITEM.link}-a`, title: "Anime Story A" },
      { ...FEED_ITEM, guid: "b", link: `${FEED_ITEM.link}-b`, title: "Anime Story B" },
    ]
    const { deps } = makeDeps({ fetchFeed: vi.fn(async () => ({ ok: true as const, data: { items } })) })

    const result = await runNewsIngest({ limit: 2 }, deps)
    expect(result.published).toBe(2)
    expect(deps.push).toHaveBeenCalledTimes(1)
    expect(deps.push).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("New on the blog:") }))
  })
})
