import Link from 'next/link'
import { Flame } from 'lucide-react'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { AdSlot } from '@/components/ad-slot'
import type { series as Series, creators as Creator } from '@/lib/db/schema'

interface EpisodesSidebarProps {
  trendingSeries: { series: typeof Series.$inferSelect; creator: typeof Creator.$inferSelect | null; totalViews: number }[]
}

export function EpisodesSidebar({ trendingSeries }: EpisodesSidebarProps) {
  return (
    <aside className="space-y-8 lg:sticky lg:top-20">
      <nav aria-label="Episodes" className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Episodes
        </h3>
        <ul className="space-y-1 text-sm font-medium">
          <li>
            <Link href="/episodes" className="block rounded-md py-1.5 hover:text-primary">
              All episodes
            </Link>
          </li>
          <li>
            <Link href="/episodes/new-releases" className="block rounded-md py-1.5 hover:text-primary">
              New releases
            </Link>
          </li>
          <li>
            <Link href="/episodes/upcoming" className="block rounded-md py-1.5 hover:text-primary">
              Upcoming
            </Link>
          </li>
          <li>
            <Link href="/episodes/browse" className="block rounded-md py-1.5 hover:text-primary">
              Browse the catalog
            </Link>
          </li>
        </ul>
      </nav>

      <section id="newsletter" className="scroll-mt-24 rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 text-base font-bold text-foreground">
          Get weekly anime drops, straight to your inbox.
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          New episodes, reviews, and recommendations every Sunday. No spam.
        </p>
        <NewsletterSignup />
      </section>

      <AdSlot slot="sidebar" />

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Flame className="h-4 w-4 text-primary" /> Trending Now
        </h3>
        <div className="mt-3 divide-y divide-border">
          {trendingSeries.map(({ series: s }, idx) => (
            <div key={s.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="w-6 text-2xl font-bold leading-none text-primary/60">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="flex-1">
                <Link
                  href={`/episodes/${s.slug}`}
                  className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary"
                >
                  {s.title}
                </Link>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.genre || 'Anime'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}