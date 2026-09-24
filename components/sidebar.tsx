import Link from "next/link"
import { ArrowRight, Flame, Clock, Vote, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { CATEGORIES, type Post } from "@/lib/posts"
import type { TrendingPost } from "@/lib/trending"
import { PostCard } from "@/components/post-card"
import { NewsletterForm } from "@/components/newsletter-form"
import { AdSlot } from "@/components/ad-slot"
import { PollPlacement } from "@/components/poll-placement"

type SidebarProps = {
  recent: Post[]
  trending: TrendingPost[]
  showAnnotationPanel?: boolean
  showCommunityPoll?: boolean
  showPollsLink?: boolean
}

export async function Sidebar({
  recent,
  trending,
  showAnnotationPanel = false,
  showCommunityPoll = false,
  showPollsLink = false,
}: SidebarProps) {
  return (
    <aside className="space-y-8 lg:sticky lg:top-20 lg:self-start">
      <div id="newsletter" className="scroll-mt-24">
        <NewsletterForm variant="card" />
      </div>

      <AdSlot slot="sidebar" />

      {showPollsLink ? (
        <Link
          href="/polls"
          className="group block rounded-xl border border-primary/30 bg-primary/10 p-5 transition-colors hover:border-primary/60 hover:bg-primary/15"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
                <Vote className="h-4 w-4 text-primary" />
                Community polls
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Share your opinion and see what the community thinks.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Click to view polls
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </div>
        </Link>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
          <Flame className="h-4 w-4 text-primary" /> Trending Now
        </h3>
        <div className="mt-3 divide-y divide-border">
          {trending.map((p, idx) => (
            <div key={p.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="font-display text-2xl font-bold text-primary/60 leading-none w-6">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <Link
                  href={`/blog/${p.slug}`}
                  className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary"
                >
                  {p.title}
                </Link>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {p.category}
                  </p>
                  {p.trendSignals ? (
                    p.trendSignals.growthRate > 0.2 ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-500" title="Trending upward">
                        <TrendingUp className="size-3" aria-hidden="true" /> Up
                      </span>
                    ) : p.trendSignals.growthRate < -0.2 ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground" title="Cooling down">
                        <TrendingDown className="size-3" aria-hidden="true" /> Down
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground" title="Steady trend">
                        <Minus className="size-3" aria-hidden="true" /> Steady
                      </span>
                    )
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
          <Clock className="h-4 w-4 text-primary" /> Recent Posts
        </h3>
        <div className="mt-2 space-y-1">
          {recent.map((p) => (
            <PostCard key={p.id} post={p} variant="compact" />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold text-foreground">Categories</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <Link
                href={`/blog?category=${encodeURIComponent(c)}`}
                className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground/80 hover:border-primary hover:text-primary"
              >
                {c}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {showCommunityPoll ? <PollPlacement source="blog_article" /> : null}

      {showAnnotationPanel ? (
        <div id="comments-pin-panel" className="mt-4" aria-live="polite" />
      ) : null}

      <AdSlot slot="sidebar" />

    </aside>
  )
}
