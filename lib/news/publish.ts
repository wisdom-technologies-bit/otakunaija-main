import type { ArticleContent } from "./ann"
import type { IngestRow, NewsStore } from "./store"
import { slugifyTitle } from "./slug"
import type { RewrittenArticle } from "./rewrite"
import { countWords } from "./rewrite"
import { normalizeCopyResult, type CopyImageLike } from "./image"
import { remoteCoverFallback } from "./image-hosts"

/**
 * Turns a rewritten ingest row into a published blog post.
 *
 * Idempotent: `posts.source_url` is uniquely indexed, and an existing post for
 * the same source URL is adopted instead of duplicated.
 *
 * Cover image order (a news post with no image falls back to the shared cover
 * tile): og:image from the fetched article → the feed's image → null.
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
  copyImage: (imageUrl: string | null) => Promise<CopyImageLike>
  /** og:image read from the article page during this run. Outranks the feed. */
  articleImageUrl?: string | null
  /** Gate for "use the remote URL as-is"; defaults to the host allow list. */
  chooseRemoteCover?: (url: string) => string | null
  log?: (line: string) => void
}

export type PublishResult =
  | {
      ok: true
      postId: number
      slug: string
      title: string
      coverImage: string | null
      imageReason: string | null
    }
  | { ok: false; error: string }

export function asRewritten(row: IngestRow): RewrittenArticle | null {
  const value = row.rewritten
  if (!value || typeof value.title !== "string" || typeof value.content !== "string") return null
  return value
}

/** og:image → feed image → nothing. */
export function chooseCoverSource(row: Pick<IngestRow, "image_url">, articleImageUrl?: string | null) {
  const og = articleImageUrl?.trim()
  if (og) return og
  const feed = row.image_url?.trim()
  return feed ? feed : null
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
    return {
      ok: true,
      postId: existing.id,
      slug: existing.slug,
      title: article.title,
      coverImage: null,
      imageReason: null,
    }
  }

  const sourceImage = chooseCoverSource(row, deps.articleImageUrl)
  if (sourceImage && sourceImage !== row.image_url) {
    // Keep the og:image so a later run (or a retry) does not fall back to null.
    await store.setImageUrl?.(row.id, sourceImage)
  }

  let coverImage: string | null = null
  let imageReason: string | null = null

  if (sourceImage) {
    let copied
    try {
      copied = normalizeCopyResult(await deps.copyImage(sourceImage))
    } catch (error) {
      copied = { error: `image_fetch_failed: ${error instanceof Error ? error.message : String(error)}` }
    }

    if ("url" in copied) {
      coverImage = copied.url
    } else {
      imageReason = copied.error
      // Hotlink failures are common; a trusted host may be used directly.
      coverImage = (deps.chooseRemoteCover ?? remoteCoverFallback)(sourceImage)
      deps.log?.(
        `news: cover copy failed for guid=${row.guid} (${copied.error})${
          coverImage ? ", using the source URL" : ""
        }`,
      )
    }
  } else {
    imageReason = "no_image"
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

    // Publishing wins; a cover problem is recorded but never blocks the post.
    await store.setStatus(row.id, "published", { postId: created.id, error: imageReason })
    deps.log?.(
      `news: published guid=${row.guid} post=${created.id} slug=${created.slug}` +
        (imageReason ? ` (image: ${imageReason})` : ""),
    )
    return {
      ok: true,
      postId: created.id,
      slug: created.slug,
      title: article.title,
      coverImage,
      imageReason,
    }
  } catch (error) {
    if (store.isUniqueViolation(error)) {
      const adopted = await store.findPostBySourceUrl(row.source_url)
      if (adopted) {
        await store.setStatus(row.id, "published", { postId: adopted.id, error: imageReason })
        deps.log?.(`news: guid=${row.guid} adopted existing post ${adopted.id}`)
        return {
          ok: true,
          postId: adopted.id,
          slug: adopted.slug,
          title: article.title,
          coverImage,
          imageReason,
        }
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
