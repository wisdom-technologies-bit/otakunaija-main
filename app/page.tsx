import { hpDisplay } from "./home-fonts"
import "./home-premium.css"
import { HomeHero } from "@/components/home/home-hero"
import { HomeIntroStrip } from "@/components/home/home-intro-strip"
import { HomeFeed } from "@/components/home/home-feed"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { HomeSidebar } from "@/components/home/home-sidebar"
import { AdSlot } from "@/components/ad-slot"
import { EnableNotifications } from "@/components/push/enable-notifications"
import { getFeaturedPosts, getNewsPosts, getRecentPosts, getTrendingPosts } from "@/lib/posts"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const [featured, recent, trending, news] = await Promise.all([
    getFeaturedPosts(4),
    getRecentPosts(6),
    getTrendingPosts(5),
    getNewsPosts(4),
  ])

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className={`${hpDisplay.variable} home-premium flex-1`}>
        <HomeHero posts={featured.slice(0, 4)} />
        <HomeIntroStrip />

        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <section className="home-premium-feed-section">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0"><HomeFeed initialPosts={recent} initialOffset={recent.length} inlineAd={<div className="my-8 md:my-10"><AdSlot slot="footer" /></div>} /></div>
              <div className="min-w-0"><HomeSidebar trending={trending} news={news} /></div>
            </div>
          </section>
          <EnableNotifications />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
