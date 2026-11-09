import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Clock, Flame } from "lucide-react"
import { AdSlot } from "@/components/ad-slot"
import { NewsletterForm } from "@/components/newsletter-form"
import { PostCoverFallback } from "@/components/post-cover-fallback"
import { RelativeTime } from "@/components/home/relative-time"
import { BLOG_CATEGORIES, type Post } from "@/lib/posts"
import { resolveCover, sourceChipLabel } from "@/lib/post-ui"

type BlogSidebarProps = {
  trending: Post[]
  news: Post[]
}

function Thumb({ post }: { post: Post }) {
  const cover = resolveCover(post)
  return (
    <span className="otk-thumb">
      {cover.kind === "image" ? (
        <Image src={cover.src} alt="" fill sizes="56px" loading="lazy" className="object-cover" />
      ) : (
        <PostCoverFallback category={cover.category} showSiteMark={false} showLabel={false} />
      )}
    </span>
  )
}

/** Blog rail: trending, latest news, categories, newsletter and an ad slot. */
export function BlogSidebar({ trending, news }: BlogSidebarProps) {
  return (
    <aside className="otk-aside" aria-label="Trending and latest news">
      {trending.length > 0 ? (
        <section className="otk-aside-section" aria-labelledby="blog-trending-title">
          <h2 id="blog-trending-title" className="otk-aside-title flex items-center gap-2">
            <Flame className="size-4 text-[var(--otk-accent)]" aria-hidden="true" />
            Trending
          </h2>
          <ol className="divide-y divide-[var(--otk-border)]">
            {trending.slice(0, 5).map((post, index) => (
              <li key={post.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
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
        <section className="otk-aside-section" aria-labelledby="blog-latest-news-title">
          <h2 id="blog-latest-news-title" className="otk-aside-title flex items-center gap-2">
            <Clock className="size-4 text-[var(--otk-accent)]" aria-hidden="true" />
            Latest news
          </h2>
          <ul className="divide-y divide-[var(--otk-border)]">
            {news.slice(0, 4).map((post) => {
              const source = sourceChipLabel(post.source_name)
              return (
                <li key={post.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="otk-focus line-clamp-2 text-sm font-medium leading-snug text-[var(--otk-text)] hover:text-[var(--otk-accent)]"
                  >
                    {post.title}
                  </Link>
                  <p className="otk-meta mt-1">
                    <RelativeTime date={post.published_at} />
                    {source ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{post.source_name}</span>
                      </>
                    ) : null}
                  </p>
                </li>
              )
            })}
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

      <section className="otk-aside-section" aria-labelledby="blog-categories-title">
        <h2 id="blog-categories-title" className="otk-aside-title">
          Categories
        </h2>
        <ul className="flex flex-wrap gap-2">
          {BLOG_CATEGORIES.map((item) => (
            <li key={item}>
              <Link
                href={`/blog?category=${encodeURIComponent(item)}`}
                className="otk-pill otk-focus"
                style={{ minHeight: "2.25rem", paddingInline: "0.75rem", fontSize: "0.75rem" }}
              >
                {item}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="otk-aside-section" id="newsletter">
        <h2 className="otk-aside-title">Newsletter</h2>
        <NewsletterForm variant="card" />
      </section>

      <div className="min-h-64">
        <AdSlot slot="sidebar" />
      </div>
    </aside>
  )
}

export default BlogSidebar
