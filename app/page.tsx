import { hpDisplay } from "./home-fonts"
import "./home-premium.css"
import { HomeHero } from "@/components/home/home-hero"
import { HomeIntroStrip } from "@/components/home/home-intro-strip"
import { HomeFeed } from "@/components/home/home-feed"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { HomeSidebar } from "@/components/home/home-sidebar"
import { AdSlot } from "@/components/ad-slot"
import { getFeaturedPosts, getRecentPosts, getTrendingPosts } from "@/lib/posts"

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
        <div className="home-premium-ad py-4 md:py-5">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <AdSlot slot="header" />
          </div>
        </div>

        <HomeHero posts={featured.slice(0, 4)} />
        <HomeIntroStrip />

        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <section className="home-premium-feed-section">
            <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
              <HomeFeed initialPosts={recent} initialOffset={recent.length} inlineAd={<div className="my-8 md:my-10"><AdSlot slot="footer" /></div>} />
              <HomeSidebar trending={trending} />
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
