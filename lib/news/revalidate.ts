import { revalidatePath, revalidateTag } from "next/cache"

/**
 * Cache tags the blog reads through `unstable_cache` (see lib/posts.ts).
 * Publishing a news post must drop all of them.
 */
export const BLOG_CACHE_TAGS = ["blog-featured", "blog-recent", "blog-all", "blog-post", "blog-news", "sitemap"]

const BLOG_PATHS = ["/blog", "/", "/rss.xml", "/sitemap.xml"]

/**
 * Best effort: a cache-invalidation hiccup must never turn a successful
 * publish into a 500 for the cron job or the admin.
 */
export function revalidateBlogCaches(): void {
  try {
    for (const tag of BLOG_CACHE_TAGS) revalidateTag(tag, "max")
    for (const path of BLOG_PATHS) revalidatePath(path)
  } catch (error) {
    console.error("[news] cache revalidation failed", error instanceof Error ? error.message : error)
  }
}
