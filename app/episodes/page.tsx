import { Metadata } from 'next'
import {
  getAllSeriesWithCreators,
  getEpisodesBySeries,
  getRecentEpisodesAcrossAllSeries,
  getSeriesByStatus,
  getTrendingSeries,
  getAllUsedGenres,
  getSeriesByGenre,
} from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { AdSlot } from '@/components/ad-slot'
import { SeriesCard } from '@/components/episodes/series-card'
import { EpisodesSearchBar } from '@/components/episodes/episodes-search-bar'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { SeriesHeroCarousel } from '@/components/episodes/series-hero-carousel'
import { EpisodesFilterPills } from '@/components/episodes/episodes-filter-pills'
import { NewReleasesRow } from '@/components/episodes/new-releases-row'
import { OngoingSeriesScroll } from '@/components/episodes/ongoing-series-scroll'
import { EpisodesSidebar } from '@/components/episodes/episodes-sidebar'

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
  searchParams: Promise<{ genre?: string }>
}

export default async function EpisodesPage({ searchParams }: EpisodesPageProps) {
  const { genre } = await searchParams

  let error = null
  let allSeriesWithCreators: any[] = []
  let recentEpisodes: any[] = []
  let ongoingSeries: any[] = []
  let trendingSeries: any[] = []
  let genres: string[] = []
  let genreFiltered: any[] | null = null

  try {
    const results = await Promise.all([
      getAllSeriesWithCreators(),
      getRecentEpisodesAcrossAllSeries(10),
      getSeriesByStatus('ongoing'),
      getTrendingSeries(5),
      getAllUsedGenres(),
      genre ? getSeriesByGenre(genre) : Promise.resolve(null),
    ])
      ;[
        allSeriesWithCreators,
        recentEpisodes,
        ongoingSeries,
        trendingSeries,
        genres,
        genreFiltered,
      ] = results
  } catch (err) {
    console.error('Error fetching episodes data:', err)
    error = 'Failed to load episodes. Please try again later.'
  }

  // Compute episode counts for the full series grid
  const seriesWithCounts = await Promise.all(
    allSeriesWithCreators.map(async (item) => {
      const episodeCount = await getEpisodesBySeries(item.series.id).then(
        (eps) => eps.length
      )
      return {
        ...item,
        episodeCount,
      }
    })
  )

  // Hero series: use genre-filtered if active, otherwise all series (first 4)
  const heroSeries = (genreFiltered ?? allSeriesWithCreators)
    .slice(0, 4)
    .map((item) => item.series)

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
      <section className="border-b border-border/40 py-8 md:py-12">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                OtakuNaija Originals
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Watch Original Anime Episodes
              </h1>
              <p className="max-w-2xl text-sm md:text-base text-foreground/70">
                Discover exclusive anime series and episodes. Explore original content.
              </p>
            </div>
            <div className="max-w-xl pt-2">
              <EpisodesSearchBar />
            </div>
          </div>
        </div>
      </section>

      {/* Sponsored Ad Slot (horizontal) */}
      <div className="mx-auto max-w-7xl w-full px-4 md:px-6 py-6">
        <AdSlot variant="horizontal" label="Sponsored" />
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 md:px-6 py-8">
        {error && (
          <div className="mb-8 rounded-lg border border-red-400/30 bg-red-900/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Two‑column layout with safety constraints */}
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10 min-w-0 overflow-hidden">
            <SeriesHeroCarousel seriesList={heroSeries} />

            <EpisodesFilterPills genres={genres} activeGenre={genre} />

            <NewReleasesRow items={recentEpisodes} />

            <OngoingSeriesScroll items={ongoingSeries} />

            <AdSlot slot="in-article" label="In‑Article Ad" />
          </div>

          <EpisodesSidebar trendingSeries={trendingSeries} />
        </div>

        {/* Original full series grid – kept below the new layout */}
        {seriesWithCounts.length > 0 ? (
          <>
            <div className="mt-16">
              <h2 className="mb-6 text-2xl font-bold text-foreground">
                All Series
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {seriesWithCounts.map((item) => (
                  <SeriesCard
                    key={item.series.id}
                    series={{
                      ...item.series,
                      episodeCount: item.episodeCount,
                    }}
                    creatorName={item.creator?.name}
                  />
                ))}
              </div>
            </div>

            {/* Newsletter – kept from original */}
            <div className="mt-16 rounded-lg border border-border/60 bg-card/40 p-8 md:p-12">
              <div className="max-w-2xl">
                <h2 className="mb-2 text-2xl font-bold text-foreground">
                  Get weekly anime drops, straight to your inbox.
                </h2>
                <p className="mb-6 text-foreground/70">
                  Subscribe to stay updated on new episodes and exclusive creator content.
                </p>
                <NewsletterSignup />
              </div>
            </div>
          </>
        ) : (
          <div className="mt-16 rounded-lg border border-border/40 bg-card/40 p-12 text-center">
            <p className="text-foreground/70">
              {error ? 'Unable to load series.' : 'No series available yet. Check back soon!'}
            </p>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}