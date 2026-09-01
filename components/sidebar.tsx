import Link from "next/link"
import { Flame, Clock } from "lucide-react"
import { CATEGORIES, type Post } from "@/lib/posts"
import { PostCard } from "@/components/post-card"
import { NewsletterForm } from "@/components/newsletter-form"
import { AdSlot } from "@/components/ad-slot"

type SidebarProps = {
  recent: Post[]
  trending: Post[]
  showAnnotationPanel?: boolean
}

export function Sidebar({ recent, trending, showAnnotationPanel = false }: SidebarProps) {
  return (
    <aside className="space-y-8 lg:sticky lg:top-20">
      <div id="newsletter" className="scroll-mt-24">
        <NewsletterForm variant="card" />
      </div>

      <AdSlot slot="sidebar" />

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
                <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {p.category} · {p.views.toLocaleString()} views
                </p>
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

      <AdSlot slot="sidebar" />

      {showAnnotationPanel ? (
        <div id="comments-pin-panel" aria-live="polite" />
      ) : null}

    </aside>
  )
}
