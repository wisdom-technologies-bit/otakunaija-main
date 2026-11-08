import type { ArticleContent } from "./ann"
import type { IngestRow, NewsStore } from "./store"
import { slugifyTitle } from "./slug"
import type { RewrittenArticle } from "./rewrite"
import { countWords } from "./rewrite"

/**
 * Turns a rewritten ingest row into a published blog post.
 *
 * Idempotent: `posts.source_url` is uniquely indexed, and an existing post for
 * the same source URL is adopted instead of duplicated.
 */

export const NEWS_CATEGORY = "News"
export const NEWS_AUTHOR = "OtakuNaija News"
export const SOURCE_NAME = "Anime News Network"

const WORDS_PER_MINUTE = 200

export function computeReadTime(content: string): number {
  return Math.max(1, Math.round(countWords(content) / WORDS_PER_MINUTE))
}

export type PublishDeps = {
  store: NewsStore
  copyImage: (imageUrl: string | null) => Promise<string | null>
  log?: (line: string) => void
}

export type PublishResult =
  | { ok: true; postId: number; slug: string; title: string }
  | { ok: false; error: string }

export function asRewritten(row: IngestRow): RewrittenArticle | null {
  const value = row.rewritten
  if (!value || typeof value.title !== "string" || typeof value.content !== "string") return null
  return value
}

export async function publishIngestRow(row: IngestRow, deps: PublishDeps): Promise<PublishResult> {
  const { store } = deps
  const article = asRewritten(row)
  if (!article) {
    await store.setStatus(row.id, "failed", { error: "no_rewritten_content", attempts: row.attempts + 1 })
    return { ok: false, error: "no_rewritten_content" }
  }

  const existing = await store.findPostBySourceUrl(row.source_url)
  if (existing) {
    await store.setStatus(row.id, "published", { postId: existing.id, error: null })
    deps.log?.(`news: guid=${row.guid} already published as post ${existing.id}`)
    return { ok: true, postId: existing.id, slug: existing.slug, title: article.title }
  }

  let coverImage: string | null = null
  try {
    coverImage = await deps.copyImage(row.image_url)
  } catch (error) {
    // A missing cover falls back to /placeholder.svg via getCoverImage().
    deps.log?.(`news: cover copy failed for guid=${row.guid}: ${error instanceof Error ? error.message : String(error)}`)
    coverImage = null
  }

  const base = slugifyTitle(article.title)
  const slug = await store.chooseUniqueSlug(base)

  try {
    const created = await store.insertPost({
      slug,
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
      coverImage,
      category: NEWS_CATEGORY,
      author: NEWS_AUTHOR,
      tags: article.tags,
      readTime: computeReadTime(article.content),
      sourceName: row.source_name ?? SOURCE_NAME,
      sourceUrl: row.source_url,
    })

    await store.setStatus(row.id, "published", { postId: created.id, error: null })
    deps.log?.(`news: published guid=${row.guid} post=${created.id} slug=${created.slug}`)
    return { ok: true, postId: created.id, slug: created.slug, title: article.title }
  } catch (error) {
    if (store.isUniqueViolation(error)) {
      const adopted = await store.findPostBySourceUrl(row.source_url)
      if (adopted) {
        await store.setStatus(row.id, "published", { postId: adopted.id, error: null })
        deps.log?.(`news: guid=${row.guid} adopted existing post ${adopted.id}`)
        return { ok: true, postId: adopted.id, slug: adopted.slug, title: article.title }
      }
    }

    const message = describeSqlError(error)
    await store.setStatus(row.id, "failed", { error: `publish_failed: ${message}`, attempts: row.attempts + 1 })
    deps.log?.(`news: publish failed guid=${row.guid}: ${message}`)
    return { ok: false, error: message }
  }
}

/** Adds the "you probably forgot to run the SQL file" hint the operator needs. */
export function describeSqlError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/column .*source_(name|url).* does not exist|relation "news_ingest" does not exist/i.test(message)) {
    return `${message} (run docs/sql/news-automation.sql in the Neon SQL editor)`
  }
  return message
}

export type { ArticleContent }
