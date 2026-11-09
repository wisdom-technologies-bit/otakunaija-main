import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Flame } from "lucide-react"
import { AdSlot } from "@/components/ad-slot"
import { NewsletterForm } from "@/components/newsletter-form"
import { PostCoverFallback } from "@/components/post-cover-fallback"
import { RelativeTime } from "@/components/home/relative-time"
import { resolveCover } from "@/lib/post-ui"
import type { Post } from "@/lib/posts"

type HomeSidebarProps = {
  trending: Post[]
  news?: Post[]
}

function Thumb({ post }: { post: Post }) {
  const cover = resolveCover(post)
  return (
    <span className="otk-thumb">
      {cover.kind === "image" ? (
        <Image src={cover.src} alt="" fill sizes="56px" loading="lazy" className="object-cover" />
      ) : (
        <PostCoverFallback category={cover.category} showLabel={false} />
      )}
    </span>
  )
}

/**
 * Sticky desktop rail: numbered trending list, latest news, the newsletter and
 * an ad slot. On mobile it becomes plain sections in the page flow.
 */
export function HomeSidebar({ trending, news = [] }: HomeSidebarProps) {
  return (
    <aside className="otk-aside" aria-label="Trending and latest news">
      {trending.length > 0 ? (
        <section className="otk-aside-section" aria-labelledby="home-trending-title">
          <h2 id="home-trending-title" className="otk-aside-title otk-aside-title-row">
            <Flame className="size-4 shrink-0 text-[var(--otk-accent)]" aria-hidden="true" />
            <span>Trending</span>
          </h2>
          <ol className="divide-y divide-[var(--otk-border)]">
            {trending.slice(0, 5).map((post, index) => (
              <li key={post.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="w-4 shrink-0 font-display text-sm font-bold text-[var(--otk-accent)]">
                  {index + 1}
                </span>
                <Thumb post={post} />
                <Link
                  href={`/blog/${post.slug}`}
                  className="otk-focus line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-[var(--otk-text)] hover:text-[var(--otk-accent)]"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {news.length > 0 ? (
        <section className="otk-aside-section" aria-labelledby="home-latest-news-title">
          <h2 id="home-latest-news-title" className="otk-aside-title">
            Latest news
          </h2>
          <ul className="divide-y divide-[var(--otk-border)]">
            {news.slice(0, 4).map((post) => (
              <li key={post.id} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/blog/${post.slug}`}
                  className="otk-focus line-clamp-2 text-sm font-medium leading-snug text-[var(--otk-text)] hover:text-[var(--otk-accent)]"
                >
                  {post.title}
                </Link>
                <p className="otk-meta mt-1">
                  <RelativeTime date={post.published_at} />
                </p>
              </li>
            ))}
          </ul>
          <Link
            href="/blog?category=News"
            className="otk-focus inline-flex items-center gap-1 text-sm font-semibold text-[var(--otk-accent)]"
          >
            All news
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      <section className="otk-aside-section" aria-label="Newsletter" id="newsletter">
        <NewsletterForm variant="card" />
      </section>

      <div className="min-h-64">
        <AdSlot slot="sidebar" />
      </div>
    </aside>
  )
}

export default HomeSidebar
