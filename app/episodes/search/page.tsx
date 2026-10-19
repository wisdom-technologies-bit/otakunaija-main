
import { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { searchEpisodesAndSeriesSmart } from '@/lib/db/queries'
import { SeriesCard } from '@/components/episodes/series-card'
import { EpisodeRow } from '@/components/episodes/episode-row'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { EpisodesSearchBar } from '@/components/episodes/episodes-search-bar'
import { toISO } from '@/lib/to-iso'

export const metadata: Metadata = {
  title: 'Search Episodes',
  description: 'Search anime episodes and series on OtakuNaija',
  alternates: { canonical: '/episodes/search' },
}

export const dynamic = 'force-dynamic'

type SearchPageProps = {
  searchParams: Promise<{ q?: string; type?: string }>
}

type EpisodeResult = Awaited<
  ReturnType<typeof searchEpisodesAndSeriesSmart>
>['episodesResults'][number]

type SerializedEpisodeResult = Omit<EpisodeResult, 'episode'> & {
  episode: Omit<EpisodeResult['episode'], 'publishedAt'> & {
    publishedAt: string | null
  }
}

export default async function SearchPage({
  searchParams,
}: SearchPageProps) {
  const sp = await searchParams
  const query = sp.q?.trim() || ''

  let episodesResults: SerializedEpisodeResult[] = []

  if (query) {
    const results = await searchEpisodesAndSeriesSmart(query)

    episodesResults = results.episodesResults.map((result) => ({
      ...result,
      episode: {
        ...result.episode,
        publishedAt: toISO(result.episode.publishedAt),
      },
    }))
  }

  const episodeGroups = new Map<
    number,
    {
      series: NonNullable<
        (typeof episodesResults)[number]['series']
      >
      episodes: (typeof episodesResults)[number]['episode'][]
    }
  >()

  for (const result of episodesResults) {
    if (!result.series) continue

    const existing = episodeGroups.get(result.series.id)

    if (existing) {
      existing.episodes.push(result.episode)
    } else {
      episodeGroups.set(result.series.id, {
        series: result.series,
        episodes: [result.episode],
      })
    }
  }

  const total = episodesResults.length

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
          <section className="mx-auto max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              OtakuNaija search
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              {query ? (
                <>
                  Results for{' '}
                  <span className="text-primary">“{query}”</span>
                </>
              ) : (
                'Find your next anime'
              )}
            </h1>

            <p className="mt-3 text-sm text-muted-foreground">
              {query
                ? `${total} ${total === 1 ? 'matching episode' : 'matching episodes'} across ${episodeGroups.size} ${episodeGroups.size === 1 ? 'series' : 'series'}.`
                : 'Search series, episode titles, and story descriptions.'}
            </p>

            <div className="mt-6">
              <EpisodesSearchBar
                defaultValue={query}
                autoFocus={!query}
              />
            </div>
          </section>

          {query ? (
            <>
              <div className="mx-auto mt-8 max-w-4xl border-b border-border pb-3">
                <p className="text-sm text-muted-foreground">
                  {total} matching{' '}
                  {total === 1 ? 'episode' : 'episodes'} across{' '}
                  {episodeGroups.size}{' '}
                  {episodeGroups.size === 1 ? 'series' : 'series'}
                </p>
              </div>

              {total === 0 ? (
                <div className="py-16">
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>
                        No matches for “{query}”
                      </EmptyTitle>
                      <EmptyDescription>
                        Try a shorter title, a different spelling, or
                        search by episode number.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <section className="mt-6">
                  <div className="flex flex-col gap-4">
                    {[...episodeGroups.values()].map(
                      ({ series, episodes }) => (
                        <article
                          key={series.id}
                          className="grid grid-cols-[104px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-border/60 bg-card/30 p-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4 sm:p-4 md:grid-cols-[180px_minmax(0,1fr)]"
                        >
                          <div className="min-w-0">
                            <SeriesCard
                              series={{
                                ...series,
                                episodeCount: episodes.length,
                              }}
                              variant="poster"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <h2 className="truncate text-sm font-semibold sm:text-base">
                                {series.title}
                              </h2>

                              <span className="shrink-0 text-xs text-muted-foreground">
                                {episodes.length}{' '}
                                {episodes.length === 1
                                  ? 'episode'
                                  : 'episodes'}
                              </span>
                            </div>

                            <div className="flex flex-col gap-2">
                              {episodes.slice(0, 4).map((episode) => (
                                <EpisodeRow
                                  key={episode.id}
                                  episode={episode}
                                  seriesSlug={series.slug}
                                  seriesTitle={series.title}
                                />
                              ))}

                              {episodes.length > 4 && (
                                <Link
                                  href={`/episodes/${series.slug}`}
                                  className="rounded-lg border border-dashed border-primary/40 px-3 py-2 text-center text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                                >
                                  See all episodes ({episodes.length})
                                </Link>
                              )}
                            </div>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="py-20 text-center">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>
                    Start with a title or episode
                  </EmptyTitle>
                  <EmptyDescription>
                    Use the search field above to explore the catalogue.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
