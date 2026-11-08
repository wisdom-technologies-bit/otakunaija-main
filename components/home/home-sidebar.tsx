import Link from "next/link"
import { ArrowRight, Minus, TrendingDown, TrendingUp, Vote } from "lucide-react"
import { CATEGORIES, formatRelativeTime, type Post } from "@/lib/posts"
import type { TrendingPost } from "@/lib/trending"
import { AdSlot } from "@/components/ad-slot"
import { NewsletterForm } from "@/components/newsletter-form"

type HomeSidebarProps = {
  trending: TrendingPost[]
  news?: Post[]
}

export function HomeSidebar({ trending, news = [] }: HomeSidebarProps) {
  return (
    <aside className="min-w-0 w-full flex flex-col gap-8">
      <div id="newsletter" className="scroll-mt-32">
        <NewsletterForm variant="card" />
      </div>

      <div className="my-6 min-h-64">
        <AdSlot slot="sidebar" />
      </div>

      <Link href="/polls" className="group block rounded-[var(--hp-radius)] bg-[var(--hp-surface)] p-5 hp-focus">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-display text-base font-semibold">
              <Vote className="size-4 text-[var(--hp-accent)]" aria-hidden="true" />
              Community polls
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--hp-text-dim)]">Share your opinion and see what the community thinks.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--hp-accent)]">
              Click to view polls
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>

      {trending.length > 0 ? (
        <section aria-labelledby="home-trending-title">
          <h2 id="home-trending-title" className="hp-display text-2xl">Trending Now</h2>
          <ol className="mt-4 divide-y divide-[var(--hp-border)]">
            {trending.slice(0, 5).map((post, index) => {
              const signal = post.trendSignals
                ? post.trendSignals.growthRate > 0.05
                  ? "Up"
                  : post.trendSignals.growthRate < -0.05
                    ? "Down"
                    : "Steady"
                : null
              const SignalIcon = signal === "Up" ? TrendingUp : signal === "Down" ? TrendingDown : Minus
              return (
                <li key={post.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                  <span className="font-display text-2xl leading-none text-[var(--hp-text-dim)] opacity-60">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/blog/${post.slug}`} className="hp-title hp-focus line-clamp-2 text-sm">{post.title}</Link>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="hp-chip">{post.category}</span>
                      {signal ? <span className="inline-flex items-center gap-1 text-[0.625rem] text-[var(--hp-text-dim)]" title={signal}><SignalIcon className="size-3" aria-hidden="true" /><span className="sr-only">{signal}</span></span> : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      {news.length > 0 ? (
        <section aria-labelledby="home-news-title">
          <h2 id="home-news-title" className="hp-display text-2xl">Latest anime news</h2>
          <ul className="mt-4 divide-y divide-[var(--hp-border)]">
            {news.slice(0, 4).map((post) => (
              <li key={post.id} className="py-3 first:pt-0 last:pb-0">
                <Link href={`/blog/${post.slug}`} className="hp-title hp-focus line-clamp-2 text-sm">
                  {post.title}
                </Link>
                <div className="mt-2 flex items-center gap-2">
                  <span className="hp-chip">News</span>
                  <span className="text-[0.625rem] text-[var(--hp-text-dim)]">{formatRelativeTime(post.published_at)}</span>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/blog?category=News" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--hp-accent)]">
            All news
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      <section aria-labelledby="home-categories-title">
        <h2 id="home-categories-title" className="hp-display text-2xl">Categories</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((category) => <li key={category}><Link href={`/blog?category=${encodeURIComponent(category)}`} className="hp-chip hp-focus">{category}</Link></li>)}
        </ul>
      </section>

      <div className="my-6 min-h-64">
        <AdSlot slot="sidebar" />
      </div>
    </aside>
  )
}
