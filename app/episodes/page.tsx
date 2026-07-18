import { Metadata } from 'next'
import { getAllSeriesWithCreators, getEpisodesBySeries } from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { AdSlot } from '@/components/ad-slot'
import { SeriesCard } from '@/components/episodes/series-card'
import { EpisodesSearchBar } from '@/components/episodes/episodes-search-bar'
import { NewsletterSignup } from '@/components/newsletter-signup'

export const metadata: Metadata = {
  title: 'OtakuNaija Originals | Episodes',
  description: 'Watch original anime series. Discover exclusive anime content.',
  openGraph: {
    title: 'OtakuNaija Originals | Episodes',
    description: 'Watch original anime series and episodes.',
  },
}

export default async function EpisodesPage() {
  let seriesData: any[] = []
  let error = null

  try {
    const data = await getAllSeriesWithCreators()
    seriesData = data
  } catch (err) {
    console.error('Error fetching series:', err)
    error = 'Failed to load series. Please try again later.'
  }

  // Count episodes for each series
  const seriesWithCounts = await Promise.all(
    seriesData.map(async (item) => {
      const episodeCount = await getEpisodesBySeries(item.series.id).then(
        (eps) => eps.length
      )
      return {
        ...item,
        episodeCount,
      }
    })
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* Page Header */}
      <section className="border-b border-border/40 py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                OtakuNaija Originals
              </p>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                Watch Original Anime Episodes
              </h1>
              <p className="max-w-2xl text-lg text-foreground/70">
                Discover exclusive anime series and episodes. Explore original content.
              </p>
            </div>
            <div className="max-w-2xl">
              <EpisodesSearchBar />
            </div>
          </div>
        </div>
      </section>

      {/* Sponsored Ad Slot */}
      <div className="mx-auto max-w-7xl w-full px-4 md:px-6 py-8">
        <AdSlot variant="horizontal" label="Sponsored" />
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
        {error && (
          <div className="mb-8 rounded-lg border border-red-400/30 bg-red-900/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {seriesWithCounts.length > 0 ? (
          <>
            {/* Series Grid */}
            <div className="mb-12">
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

            {/* Newsletter Section */}
            <div className="rounded-lg border border-border/60 bg-card/40 p-8 md:p-12">
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
          <div className="rounded-lg border border-border/40 bg-card/40 p-12 text-center">
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
