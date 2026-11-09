import { hpDisplay } from "./home-fonts"
import "./home-premium.css"
import { HomeHero } from "@/components/home/home-hero"
import { HomeIntroStrip } from "@/components/home/home-intro-strip"
import { HomeFeed } from "@/components/home/home-feed"
import { NewsTicker } from "@/components/news-ticker"
import { HomeTopStories } from "@/components/home/home-top-stories"
import { NewsletterInlineBar } from "@/components/home/newsletter-inline-bar"
import { HomeWatchNow, type WatchNowItem } from "@/components/home/home-watch-now"
import { HomeTrendingSeries, type TrendingSeriesItem } from "@/components/home/home-trending-series"
import { HomeNewsTopics } from "@/components/home/home-news-topics"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { HomeSidebar } from "@/components/home/home-sidebar"
import { AdSlot } from "@/components/ad-slot"
import { PollPlacement } from "@/components/poll-placement"
import { EnableNotifications } from "@/components/push/enable-notifications"
import { getFeaturedPosts, getNewsPosts, getRecentPosts, getTrendingPosts } from "@/lib/posts"
import { getPopularTodaySeries, getRecentEpisodesAcrossAllSeries, getTrendingSeries, getUpcomingEpisodes } from "@/lib/db/queries"
import { getAiringThisWeek, type AiringItem } from "@/lib/anilist/upcoming-store"
import { toISO } from "@/lib/to-iso"
import { NEW_POST_WINDOW_HOURS, createSeenTracker, dedupePosts, pickUnseen } from "@/lib/post-ui"

export const dynamic = "force-dynamic"

const NEWS_TOPIC_TABS = ["News", "Guides", "Shonen", "Romance", "Action"] as const

type EpisodeRow = { episode: Record<string, unknown>; series: Record<string, unknown> | null }

function serializeEpisodes(items: Array<{ episode: any; series: any }>): WatchNowItem[] {
  return items.map(({ episode, series }) => ({
    episode: {
      ...episode,
      publishedAt: toISO(episode.publishedAt),
    },
    series: series ? { slug: String(series.slug), title: String(series.title) } : null,
  })) as WatchNowItem[]
}

export default async function HomePage() {
  const [featured, recent, trending, news] = await Promise.all([
    getFeaturedPosts(5),
    getRecentPosts(16),
    getTrendingPosts(5),
    getNewsPosts(16),
  ])

  let recentEpisodes: Array<{ episode: any; series: any }> = []
  let upcomingEpisodes: Array<{ episode: any; series: any }> = []
  let trendingSeries: TrendingSeriesItem[] = []
  try {
    const [recentRows, upcomingRows, seriesRows] = await Promise.all([
      getRecentEpisodesAcrossAllSeries(12),
      getUpcomingEpisodes(6),
      getTrendingSeries(5),
    ])
    recentEpisodes = recentRows as typeof recentEpisodes
    upcomingEpisodes = upcomingRows as typeof upcomingEpisodes
    trendingSeries = (seriesRows as Array<{ series: any }>).map(({ series }) => ({
      slug: String(series.slug),
      title: String(series.title),
      posterImageUrl: series.posterImageUrl ?? null,
      genre: series.genre ?? null,
      status: series.status ?? null,
    }))
  } catch (error) {
    console.error("[home] episode catalogue unavailable", error)
  }

  // Airing today, from the cached AniList tables. Only tops up the "Coming up"
  // strip when our own scheduled episodes are thin.
  let airingToday: AiringItem[] = []
  try {
    const week = await getAiringThisWeek()
    airingToday = (week.days.find((day) => day.isToday)?.items ?? []).slice(0, 4)
  } catch (error) {
    console.error("[home] upcoming anime cache unavailable", error)
  }

  // One post is never rendered twice on the page: sections claim posts in
  // reading order before they are handed to a component.
  const seen = createSeenTracker()
  const tickerPosts = pickUnseen(news, seen, 6)
  const newsTopicPosts = pickUnseen(news, seen, 6)
  const sidebarNews = pickUnseen(news, seen, 4)
  const topStories = pickUnseen(dedupePosts([...featured, ...recent]), seen, 8)
  const feedPosts = pickUnseen(recent, seen, 12)

  const now = Date.now()

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className={`${hpDisplay.variable} home-premium otk-page flex-1`}>
        <HomeHero posts={featured.slice(0, 4)} />

        <NewsTicker posts={tickerPosts} />

        <HomeIntroStrip />

        <div className="hp-container pb-16 pt-8 md:pt-10">
          <div className="otk-layout">
            <div className="min-w-0 space-y-12 md:space-y-16">
              <HomeTopStories
                lead={topStories[0]}
                secondary={topStories.slice(1, 4)}
                grid={topStories.slice(4, 8)}
              />

              <NewsletterInlineBar />

              <HomeWatchNow
                recent={serializeEpisodes(recentEpisodes)}
                upcoming={serializeEpisodes(upcomingEpisodes)}
                now={now}
                airingToday={airingToday}
              />

              <PollPlacement source="homepage" />

              <HomeTrendingSeries items={trendingSeries} />

              <HomeNewsTopics tabs={NEWS_TOPIC_TABS} initialPosts={newsTopicPosts} />

              <HomeFeed
                initialPosts={feedPosts}
                initialOffset={recent.length}
                inlineAd={
                  <div className="my-4">
                    <AdSlot slot="footer" />
                  </div>
                }
              />
            </div>

            <HomeSidebar trending={trending} news={sidebarNews} />
          </div>

          <EnableNotifications />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
