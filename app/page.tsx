import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { PostCard } from "@/components/post-card"
import { Sidebar } from "@/components/sidebar"
import { AdSlot } from "@/components/ad-slot"
import { NewsletterForm } from "@/components/newsletter-form"
import { Button } from "@/components/ui/button"
import { getFeaturedPosts, getRecentPosts, getTrendingPosts, CATEGORIES } from "@/lib/posts"

export const revalidate = 300

export default async function HomePage() {
  const [featured, recent, trending] = await Promise.all([
    getFeaturedPosts(3),
    getRecentPosts(6),
    getTrendingPosts(5),
  ])

  const [hero, ...secondaryFeatured] = featured

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="py-4">
            <AdSlot slot="header" />
          </div>

          {/* Hero */}
          <section className="py-8 md:py-12">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="flex items-center gap-2 text-primary mb-4">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Featured Story</span>
                </div>
                {hero ? <PostCard post={hero} variant="featured" priority /> : null}
              </div>

              <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8 flex flex-col justify-between">
                <div>
                  <h2 className="font-display text-2xl md:text-3xl font-bold leading-tight text-balance">
                    Naija&apos;s home for <span className="text-primary">anime culture</span>.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Reviews, news, episode breakdowns, and recommendations — written by Nigerian otakus, for the global
                    anime community.
                  </p>
                </div>
                <div className="mt-6">
                  <NewsletterForm variant="hero" />
                  <p className="mt-2 text-xs text-muted-foreground">Free. Unsubscribe anytime.</p>
                </div>
              </div>
            </div>

            {secondaryFeatured.length > 0 ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                {secondaryFeatured.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            ) : null}
          </section>

          {/* Categories strip */}
          <section className="py-6 border-y border-border">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Browse by genre:
              </span>
              {CATEGORIES.map((c) => (
                <Link
                  key={c}
                  href={`/blog?category=${encodeURIComponent(c)}`}
                  className="rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-foreground/80 hover:border-primary hover:text-primary"
                >
                  {c}
                </Link>
              ))}
            </div>
          </section>

          {/* Latest + Sidebar */}
          <section className="py-10 md:py-14">
            <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="flex items-end justify-between mb-6">
                  <div>
                    <h2 className="font-display text-2xl md:text-3xl font-bold">Latest articles</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Fresh takes on what&apos;s airing now.
                    </p>
                  </div>
                  <Button asChild variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10">
                    <Link href="/blog" className="gap-1">
                      View all <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  {recent.slice(0, 4).map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>

                <div className="my-10">
                  <AdSlot slot="in-article" />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  {recent.slice(4).map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>
              </div>

              <Sidebar recent={recent.slice(0, 4)} trending={trending} />
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
