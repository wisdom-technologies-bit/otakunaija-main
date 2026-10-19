import type { Metadata } from 'next'
import {
  getRecentEpisodesAcrossAllSeries,
  getUpcomingEpisodes,
  getTrendingSeries,
  getPopularTodaySeries,
} from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { AdSlot } from '@/components/ad-slot'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { GenreRow } from '@/components/episodes/genre-row'
import { toISO } from '@/lib/to-iso'
import { SeriesHeroCarousel } from '@/components/episodes/series-hero-carousel'
import { ResumeWatchingRow } from '@/components/episodes/resume-watching-row'
import { NewReleasesRow } from '@/components/episodes/new-releases-row'
import RecommendedRow from '@/components/episodes/recommended-row'
import { UpcomingRow } from '@/components/episodes/upcoming-row'
import { EpisodesSidebar } from '@/components/episodes/episodes-sidebar'
import { PollPlacement } from '@/components/poll-placement'
import { MoviesRow } from '@/components/episodes/movies-row'
import { PopularTodayRow } from '@/components/episodes/popular-today-row'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Episodes',
  description: 'Watch original anime series. Discover exclusive anime content.',
  alternates: { canonical: '/episodes' },
  openGraph: {
    title: 'Episodes',
    description: 'Watch original anime series and episodes.',
  },
}

interface EpisodesPageProps {
  searchParams: Promise<{ genre?: string; status?: string }>
}

function GenreRowSkeleton() {
  return <div className="flex gap-4 overflow-hidden"><div className="h-52 w-[120px] shrink-0 rounded-lg bg-muted" /><div className="h-52 w-[120px] shrink-0 rounded-lg bg-muted" /><div className="h-52 w-[120px] shrink-0 rounded-lg bg-muted" /><div className="h-52 w-[120px] shrink-0 rounded-lg bg-muted" /></div>
}

export default async function EpisodesPage({ searchParams }: EpisodesPageProps) {
  const { genre, status } = await searchParams
  if (genre) redirect(`/episodes/browse?genre=${encodeURIComponent(genre)}`)
  if (status) redirect(`/episodes/browse?status=${encodeURIComponent(status)}`)

  let error = null
  let recentEpisodes: any[] = []
  let upcomingEpisodes: any[] = []
  let trendingSeries: any[] = []
  let popularToday: any[] = []
  try {
    ;[recentEpisodes, upcomingEpisodes, trendingSeries, popularToday] = await Promise.all([
      getRecentEpisodesAcrossAllSeries(10),
      getUpcomingEpisodes(12),
      getTrendingSeries(5),
      getPopularTodaySeries(10),
    ])
  } catch (err) {
    console.error('Error fetching episodes data:', err)
    error = 'Failed to load episodes. Please try again later.'
  }

  const serializeEpisodes = (items: any[]) => items.map(({ episode, series, creator }) => ({
    episode: { ...episode, publishedAt: toISO(episode.publishedAt) },
    series,
    creator,
  }))
  const serializedRecentEpisodes = serializeEpisodes(recentEpisodes)
  const serializedUpcomingEpisodes = serializeEpisodes(upcomingEpisodes)
  const heroSeries = trendingSeries.slice(0, 4).map((item) => item.series)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Home',
                    item: 'https://otakunaija.name.ng/',
                  },
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: 'Episodes',
                    item: 'https://otakunaija.name.ng/episodes',
                  },
                ],
              },
              {
                '@type': 'CollectionPage',
                name: 'Anime Episodes & Series — OtakuNaija',
                description:
                  'Browse and stream the latest anime episodes, series guides, and recaps on OtakuNaija.',
                url: 'https://otakunaija.name.ng/episodes',
              },
            ],
          }),
        }}
      />

      <SiteHeader />

      {/* Page Header */}
      <section className="border-b border-border/40 py-4 md:py-8">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="space-y-4">
            <SeriesHeroCarousel seriesList={heroSeries} />
            <ResumeWatchingRow />
          </div>
        </div>
      </section>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 md:px-6 py-8">
        {error && (
          <div className="mb-8 rounded-lg border border-red-400/30 bg-red-900/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Two‑column layout with safety constraints */}
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10 min-w-0 overflow-hidden">
            <UpcomingRow items={serializedUpcomingEpisodes} />

            <NewReleasesRow items={serializedRecentEpisodes} />

            <MoviesRow />

            <PopularTodayRow items={popularToday} />

            <RecommendedRow />

            {['Action', 'Adventure', 'Fantasy', 'Romance', 'Comedy'].map((genreName) => (
              <Suspense key={genreName} fallback={<GenreRowSkeleton />}>
                <GenreRow genre={genreName} />
              </Suspense>
            ))}

            <AdSlot slot="footer" label="footer" />
          </div>

          <EpisodesSidebar trendingSeries={trendingSeries} />
        </div>


        <PollPlacement source="episodes" className="mx-auto mt-14 max-w-2xl" />
      </main>

      <SiteFooter />
    </div>
  )
}
