import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { hpDisplay } from "./home-fonts"
import "./home-premium.css"
import { HomeHero } from "@/components/home/home-hero"
import { HomeIntroStrip } from "@/components/home/home-intro-strip"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { PostCard } from "@/components/post-card"
import { Sidebar } from "@/components/sidebar"
import { AdSlot } from "@/components/ad-slot"
import { Button } from "@/components/ui/button"
import { getFeaturedPosts, getRecentPosts, getTrendingPosts, CATEGORIES } from "@/lib/posts"
import { HomepageLatestSection } from "@/components/homepage-latest-section"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const [featured, recent, trending] = await Promise.all([
    getFeaturedPosts(4),
    getRecentPosts(6),
    getTrendingPosts(5),
  ])

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className={`${hpDisplay.variable} home-premium flex-1`}>
        <div className="py-4">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <AdSlot slot="header" />
          </div>
        </div>

        <HomeHero posts={featured.slice(0, 4)} />
        <HomeIntroStrip />

        <div className="mx-auto max-w-7xl px-4 md:px-6">
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
                  <AdSlot slot="footer" />
                </div>

                <HomepageLatestSection
                  categories={CATEGORIES}
                  initialPosts={recent.slice(4)}
                  initialOffset={recent.length}
                  trendingIds={trending.map((p) => p.id)}
                />
              </div>

              <Sidebar recent={recent.slice(0, 4)} trending={trending} showPollsLink />
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
