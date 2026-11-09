import { fetchArticle, type ArticleContent } from "./ann"
import { normalizeCopyResult, type CopyImageLike } from "./image"
import { remoteCoverFallback } from "./image-hosts"
import { revalidateBlogCaches } from "./revalidate"

/**
 * Heals posts that were published before the pipeline read `og:image`.
 *
 * Selects posts with a `source_url` and no cover, re-reads the article page,
 * copies the image to Cloudinary (falling back to the source URL when its host
 * is on the allow list) and updates `posts.cover_image`. Idempotent: once a
 * post has a cover it is no longer selected.
 */

export type BackfillPost = { id: number; slug: string; source_url: string }

export type BackfillStore = {
  listPostsMissingCover(limit: number): Promise<BackfillPost[]>
  updatePostCover(id: number, coverImage: string): Promise<void>
}

export type BackfillDeps = {
  store: BackfillStore
  fetchArticle: (url: string) => Promise<{ ok: true; data: ArticleContent } | { ok: false; error: string }>
  copyImage: (url: string | null) => Promise<CopyImageLike>
  revalidate?: () => Promise<void>
  log?: (line: string) => void
}

export type BackfillItem = {
  slug: string
  status: "updated" | "skipped" | "failed"
  reason?: string
  cover?: string
}

export type BackfillResult = {
  checked: number
  updated: number
  failed: number
  skipped: number
  dry: boolean
  reasons: Record<string, number>
  items: BackfillItem[]
}

export const DEFAULT_BACKFILL_LIMIT = 5
export const MAX_BACKFILL_LIMIT = 25
/** Every normal cron run heals this many old posts, so the backlog drains. */
export const AUTO_BACKFILL_LIMIT = 2

export function clampBackfillLimit(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value < 1) return DEFAULT_BACKFILL_LIMIT
  return Math.min(Math.floor(value), MAX_BACKFILL_LIMIT)
}

export async function backfillMissingCovers(
  options: { limit?: number; dry?: boolean } & BackfillDeps,
): Promise<BackfillResult> {
  const { store, fetchArticle: fetchOne, copyImage, dry = false } = options
  const limit = clampBackfillLimit(options.limit)

  const result: BackfillResult = {
    checked: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    dry,
    reasons: {},
    items: [],
  }

  const count = (reason: string) => {
    result.reasons[reason] = (result.reasons[reason] ?? 0) + 1
  }

  let posts: BackfillPost[] = []
  try {
    posts = await store.listPostsMissingCover(limit)
  } catch (error) {
    const reason = `list_failed: ${error instanceof Error ? error.message : String(error)}`
    count("list_failed")
    options.log?.(`backfill: ${reason}`)
    return result
  }

  for (const post of posts) {
    result.checked += 1

    const article = await fetchOne(post.source_url)
    if (!article.ok) {
      result.failed += 1
      count(`fetch_${article.error}`)
      result.items.push({ slug: post.slug, status: "failed", reason: `fetch_${article.error}` })
      continue
    }

    const sourceImage = article.data.imageUrl
    if (!sourceImage) {
      result.skipped += 1
      count("no_og_image")
      result.items.push({ slug: post.slug, status: "skipped", reason: "no_og_image" })
      continue
    }

    const copied = normalizeCopyResult(await copyImage(sourceImage))
    const cover = "url" in copied ? copied.url : remoteCoverFallback(sourceImage)

    if (!cover) {
      const reason = "url" in copied ? "no_cover" : copied.error
      result.failed += 1
      count(reason)
      result.items.push({ slug: post.slug, status: "failed", reason })
      continue
    }

    if (!dry) {
      try {
        await store.updatePostCover(post.id, cover)
      } catch (error) {
        const reason = `update_failed: ${error instanceof Error ? error.message : String(error)}`
        result.failed += 1
        count("update_failed")
        result.items.push({ slug: post.slug, status: "failed", reason })
        options.log?.(`backfill: ${reason} (${post.slug})`)
        continue
      }
    }

    result.updated += 1
    if (!("url" in copied)) count(copied.error)
    result.items.push({ slug: post.slug, status: "updated", cover })
    options.log?.(`backfill: ${post.slug} ${dry ? "would use" : "using"} ${cover}`)
  }

  if (!dry && result.updated > 0) {
    try {
      await (options.revalidate ?? revalidateBlogCaches)()
    } catch (error) {
      options.log?.(`backfill: revalidate failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return result
}
