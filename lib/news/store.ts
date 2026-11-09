import { sql } from "@/lib/db"
import type { RewrittenArticle } from "./rewrite"
import { pickUniqueSlug } from "./slug"

/**
 * All database access for the news pipeline.
 *
 * Plain tagged-template SQL (like lib/posts.ts) rather than Drizzle: the
 * `news_ingest` table and the `posts.source_*` columns ship as a hand-run SQL
 * file (docs/sql/news-automation.sql), not a Drizzle migration.
 *
 * The store is an interface so the pipeline can be unit tested with an
 * in-memory implementation.
 */

export type IngestStatus = "pending" | "rewritten" | "published" | "skipped" | "failed"

export type IngestRow = {
  id: number
  guid: string
  source_url: string
  source_name: string | null
  original_title: string | null
  original_published_at: string | null
  image_url: string | null
  topics: string[] | null
  status: IngestStatus
  attempts: number
  last_error: string | null
  rewritten: RewrittenArticle | null
  post_id: number | null
  created_at: string
  updated_at: string
}

export type NewIngestItem = {
  guid: string
  sourceUrl: string
  sourceName?: string
  title: string
  publishedAt: string | null
  imageUrl: string | null
  topics: string[]
  status?: IngestStatus
  lastError?: string | null
}

export type NewPostInput = {
  slug: string
  title: string
  excerpt: string
  content: string
  coverImage: string | null
  category: string
  author: string
  tags: string[]
  readTime: number
  sourceName: string
  sourceUrl: string
}

export type StatusPatch = {
  error?: string | null
  attempts?: number
  postId?: number | null
}

export type AdminIngestRow = IngestRow & {
  post_slug: string | null
  /** `posts.cover_image` for the published row: shown as the admin Image column. */
  post_cover_image: string | null
}

export type NewsStore = {
  insertItems(items: NewIngestItem[]): Promise<number>
  listCandidates(options: {
    limit: number
    includeRewritten: boolean
    forceGuid?: string | null
  }): Promise<IngestRow[]>
  countRemaining(options: { includeRewritten: boolean }): Promise<number>
  getRow(id: number): Promise<IngestRow | null>
  markRewritten(id: number, rewritten: RewrittenArticle, attempts: number): Promise<void>
  setStatus(id: number, status: IngestStatus, patch?: StatusPatch): Promise<void>
  /** Remember the cover source that was chosen (og:image or feed image). */
  setImageUrl?(id: number, url: string | null): Promise<void>
  findPostBySourceUrl(sourceUrl: string): Promise<{ id: number; slug: string } | null>
  chooseUniqueSlug(base: string): Promise<string>
  insertPost(input: NewPostInput): Promise<{ id: number; slug: string }>
  isUniqueViolation(error: unknown): boolean
}

type SqlRow = Record<string, unknown>

function toIngestRow(row: SqlRow): IngestRow {
  return {
    id: Number(row.id),
    guid: String(row.guid),
    source_url: String(row.source_url),
    source_name: (row.source_name as string | null) ?? null,
    original_title: (row.original_title as string | null) ?? null,
    original_published_at: (row.original_published_at as string | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
    topics: (row.topics as string[] | null) ?? null,
    status: row.status as IngestStatus,
    attempts: Number(row.attempts ?? 0),
    last_error: (row.last_error as string | null) ?? null,
    rewritten: normalizeRewritten(row.rewritten),
    post_id: row.post_id === null || row.post_id === undefined ? null : Number(row.post_id),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  }
}

function normalizeRewritten(value: unknown): RewrittenArticle | null {
  if (!value) return null
  const record = typeof value === "string" ? safeJson(value) : value
  if (!record || typeof record !== "object") return null
  const candidate = record as Record<string, unknown>
  if (typeof candidate.title !== "string" || typeof candidate.content !== "string") return null
  return {
    title: candidate.title,
    excerpt: typeof candidate.excerpt === "string" ? candidate.excerpt : "",
    content: candidate.content,
    tags: Array.isArray(candidate.tags) ? candidate.tags.map(String) : [],
    category: typeof candidate.category === "string" ? candidate.category : "News",
  }
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/**
 * Builds a Postgres text[] literal. Passing the literal (instead of a JS array)
 * keeps the driver's array serialisation out of the picture.
 */
export function pgTextArray(values: string[]): string {
  const items = values.map((value) => `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
  return `{${items.join(",")}}`
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = (error as { code?: string }).code
  if (code === "23505" || code === "23p01") return true
  const message = (error as { message?: string }).message ?? ""
  return /duplicate key value|unique constraint|unique index/i.test(message)
}

export const sqlStore: NewsStore = {
  async insertItems(items) {
    if (!items.length) return 0

    const payload = items.map((item) => ({
      guid: item.guid,
      source_url: item.sourceUrl,
      source_name: item.sourceName ?? "Anime News Network",
      original_title: item.title,
      original_published_at: item.publishedAt,
      image_url: item.imageUrl,
      topics: item.topics,
      status: item.status ?? "pending",
      last_error: item.lastError ?? null,
    }))

    const rows = (await sql`
      INSERT INTO news_ingest
        (guid, source_url, source_name, original_title, original_published_at, image_url, topics, status, last_error)
      SELECT guid, source_url, source_name, original_title, original_published_at, image_url, topics, status, last_error
      FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(
        guid text, source_url text, source_name text, original_title text,
        original_published_at timestamptz, image_url text, topics text[],
        status text, last_error text
      )
      ON CONFLICT (guid) DO NOTHING
      RETURNING id
    `) as SqlRow[]

    return rows.length
  },

  async listCandidates({ limit, includeRewritten, forceGuid }) {
    const rows = (await sql`
      SELECT * FROM news_ingest
      WHERE (
        ${forceGuid ?? null}::text IS NOT NULL AND status <> 'published' AND guid = ${forceGuid ?? null}::text
      ) OR (
        ${forceGuid ?? null}::text IS NULL AND (
          status = 'pending'
          OR (status = 'failed' AND attempts < 3)
          OR (status = 'rewritten' AND ${includeRewritten}::boolean)
        )
      )
      ORDER BY created_at ASC
      LIMIT ${limit}::int
    `) as SqlRow[]

    return rows.map(toIngestRow)
  },

  async countRemaining({ includeRewritten }) {
    const rows = (await sql`
      SELECT count(*)::int AS remaining FROM news_ingest
      WHERE status = 'pending'
         OR (status = 'failed' AND attempts < 3)
         OR (status = 'rewritten' AND ${includeRewritten}::boolean)
    `) as SqlRow[]

    return Number(rows[0]?.remaining ?? 0)
  },

  async getRow(id) {
    const rows = (await sql`SELECT * FROM news_ingest WHERE id = ${id} LIMIT 1`) as SqlRow[]
    return rows[0] ? toIngestRow(rows[0]) : null
  },

  async markRewritten(id, rewritten, attempts) {
    await sql`
      UPDATE news_ingest
      SET status = 'rewritten', rewritten = ${JSON.stringify(rewritten)}::jsonb,
          attempts = ${attempts}::int, last_error = NULL, updated_at = now()
      WHERE id = ${id}::int
    `
  },

  async setStatus(id, status, patch = {}) {
    const hasError = Object.prototype.hasOwnProperty.call(patch, "error")
    await sql`
      UPDATE news_ingest
      SET status = ${status}::text,
          attempts = COALESCE(${patch.attempts ?? null}::int, attempts),
          last_error = CASE WHEN ${hasError}::boolean THEN ${patch.error ?? null}::text ELSE last_error END,
          post_id = COALESCE(${patch.postId ?? null}::int, post_id),
          updated_at = now()
      WHERE id = ${id}::int
    `
  },

  async setImageUrl(id, url) {
    await sql`
      UPDATE news_ingest SET image_url = ${url}, updated_at = now() WHERE id = ${id}::int
    `
  },

  async findPostBySourceUrl(sourceUrl) {
    const rows = (await sql`SELECT id, slug FROM posts WHERE source_url = ${sourceUrl} LIMIT 1`) as SqlRow[]
    return rows[0] ? { id: Number(rows[0].id), slug: String(rows[0].slug) } : null
  },

  async chooseUniqueSlug(base) {
    const rows = (await sql`
      SELECT slug FROM posts WHERE slug = ${base}::text OR slug LIKE ${`${base}-%`}::text
    `) as SqlRow[]
    return pickUniqueSlug(base, rows.map((row) => String(row.slug)))
  },

  async insertPost(input) {
    const rows = (await sql`
      INSERT INTO posts
        (slug, title, excerpt, content, cover_image, category, author, tags, featured, trending, read_time, source_name, source_url, published_at)
      VALUES (
        ${input.slug}, ${input.title}, ${input.excerpt}, ${input.content}, ${input.coverImage},
        ${input.category}, ${input.author}, ${pgTextArray(input.tags)}::text[], false, false,
        ${input.readTime}::int, ${input.sourceName}, ${input.sourceUrl}, now()
      )
      RETURNING id, slug
    `) as SqlRow[]

    return { id: Number(rows[0].id), slug: String(rows[0].slug) }
  },

  isUniqueViolation,
}

/** Admin automation tab: newest ingest rows with the live post slug. */
export async function listIngestRows(limit = 100): Promise<AdminIngestRow[]> {
  const rows = (await sql`
    SELECT n.*, p.slug AS post_slug, p.cover_image AS post_cover_image
    FROM news_ingest n
    LEFT JOIN posts p ON p.id = n.post_id
    ORDER BY n.created_at DESC
    LIMIT ${limit}::int
  `) as SqlRow[]

  return rows.map((row) => ({
    ...toIngestRow(row),
    post_slug: (row.post_slug as string | null) ?? null,
    post_cover_image: (row.post_cover_image as string | null) ?? null,
  }))
}

/**
 * Posts that were published without a cover (the pre-og:image backlog), newest
 * first. Used by the cron backfill; a post that already has a cover is never
 * returned, which keeps the operation idempotent.
 */
export async function listPostsMissingCover(limit = 5): Promise<{ id: number; slug: string; source_url: string }[]> {
  const rows = (await sql`
    SELECT id, slug, source_url
    FROM posts
    WHERE source_url IS NOT NULL
      AND (cover_image IS NULL OR regexp_replace(cover_image, '^\\s+|\\s+$', '', 'g') = '')
    ORDER BY published_at DESC NULLS LAST, id DESC
    LIMIT ${limit}::int
  `) as SqlRow[]

  return rows.map((row) => ({
    id: Number(row.id),
    slug: String(row.slug),
    source_url: String(row.source_url),
  }))
}

export async function updatePostCover(id: number, coverImage: string): Promise<void> {
  await sql`UPDATE posts SET cover_image = ${coverImage} WHERE id = ${id}::int`
}

/** Small aggregate for the admin header. */
export async function getIngestCounts(): Promise<Record<IngestStatus | "total", number>> {
  const rows = (await sql`SELECT status, count(*)::int AS count FROM news_ingest GROUP BY status`) as SqlRow[]
  const counts: Record<string, number> = { pending: 0, rewritten: 0, published: 0, skipped: 0, failed: 0, total: 0 }
  for (const row of rows) {
    const status = String(row.status)
    const count = Number(row.count)
    counts[status] = count
    counts.total += count
  }
  return counts as Record<IngestStatus | "total", number>
}
