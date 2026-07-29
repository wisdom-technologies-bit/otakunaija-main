import { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { searchEpisodesAndSeriesSmart, getLatestEpisodeNumber } from '@/lib/db/queries'
import { SeriesCard } from '@/components/episodes/series-card'
import { EpisodeRow } from '@/components/episodes/episode-row'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { EpisodesSearchBar } from '@/components/episodes/episodes-search-bar'

export const metadata: Metadata = {
  title: 'Search Episodes',
  description: 'Search anime episodes and series on OtakuNaija',
  alternates: { canonical: '/episodes/search' },
}

export const revalidate = 60

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams
  const query = sp.q?.trim() || ''

  let seriesResults = []
  let episodesResults = []
  let hasResults = false

  if (query) {
    const results = await searchEpisodesAndSeriesSmart(query)
    seriesResults = results.seriesResults
    episodesResults = results.episodesResults
    hasResults = seriesResults.length > 0 || episodesResults.length > 0

    // Add episode counts to series results
    seriesResults = await Promise.all(
      seriesResults.map(async (s) => ({
        ...s,
        episodeCount: await getLatestEpisodeNumber(s.id),
      }))
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <section className="pt-12 pb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Episodes Search</p>
            <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold tracking-tight text-balance">
              {query ? `Search results for "${query}"` : 'Search episodes and series'}
            </h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground">
              {query && !hasResults && 'No results found. Try a different search term.'}
              {hasResults && `Found ${seriesResults.length} series and ${episodesResults.length} episode${episodesResults.length === 1 ? '' : 's'}.`}
            </p>

            <div className="mt-6">
              <EpisodesSearchBar defaultValue={query} />
            </div>
          </section>

          {!hasResults && query ? (
            <div className="py-12">
              <Empty>
                <EmptyHeader>No results found</EmptyHeader>
                <EmptyTitle>No matches for "{query}"</EmptyTitle>
                <EmptyDescription>
                  Try searching for different keywords, series names, or episode titles.
                </EmptyDescription>
              </Empty>
            </div>
          ) : (
            <>
              {/* Series Results */}
              {seriesResults.length > 0 && (
                <section className="mb-12">
                  <h2 className="mb-6 text-lg font-semibold">Series</h2>
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                    {seriesResults.map((s) => (
                      <SeriesCard key={s.id} series={s} variant="poster" />
                    ))}
                  </div>
                </section>
              )}

              {/* Episode Results */}
              {episodesResults.length > 0 && (
                <section className="mb-12">
                  <h2 className="mb-6 text-lg font-semibold">Episodes</h2>
                  <div className="space-y-3">
                    {episodesResults.map(({ episode, series: ser }) => (
                      ser ? (
                        <EpisodeRow
                          key={episode.id}
                          episode={episode}
                          seriesSlug={ser.slug}
                          seriesTitle={ser.title}
                        />
                      ) : null
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
