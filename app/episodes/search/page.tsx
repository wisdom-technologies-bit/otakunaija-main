import { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { searchEpisodesAndSeriesSmart, getLatestEpisodeNumber } from '@/lib/db/queries'
import { SeriesCard } from '@/components/episodes/series-card'
import { EpisodeRow } from '@/components/episodes/episode-row'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { EpisodesSearchBar } from '@/components/episodes/episodes-search-bar'
import { toISO } from '@/lib/to-iso'

export const metadata: Metadata = { title: 'Search Episodes', description: 'Search anime episodes and series on OtakuNaija', alternates: { canonical: '/episodes/search' } }
export const dynamic = 'force-dynamic'

type SearchPageProps = { searchParams: Promise<{ q?: string; type?: string }> }

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams
  const query = sp.q?.trim() || ''
  const type = sp.type === 'series' || sp.type === 'episodes' ? sp.type : 'all'
  let seriesResults: Awaited<ReturnType<typeof searchEpisodesAndSeriesSmart>>['seriesResults'] = []
  let episodesResults: Awaited<ReturnType<typeof searchEpisodesAndSeriesSmart>>['episodesResults'] = []
  if (query) {
    const results = await searchEpisodesAndSeriesSmart(query)
    seriesResults = await Promise.all(results.seriesResults.map(async (item) => ({ ...item, episodeCount: await getLatestEpisodeNumber(item.id) })))
    episodesResults = results.episodesResults.map((result) => ({ ...result, episode: { ...result.episode, publishedAt: toISO(result.episode.publishedAt) } }))
  }
  const visibleSeries = type === 'episodes' ? [] : seriesResults
  const visibleEpisodes = type === 'series' ? [] : episodesResults
  const total = seriesResults.length + episodesResults.length
  const tabHref = (tab: string) => `/episodes/search?q=${encodeURIComponent(query)}${tab === 'all' ? '' : `&type=${tab}`}`

  return <div className="flex min-h-screen flex-col bg-background"><SiteHeader /><main className="flex-1"><div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
    <section className="mx-auto max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">OtakuNaija search</p><h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{query ? <>Results for <span className="text-primary">“{query}”</span></> : 'Find your next anime'}</h1><p className="mt-3 text-sm text-muted-foreground">{query ? `${total} ${total === 1 ? 'match' : 'matches'} across the OtakuNaija catalogue.` : 'Search series, episode titles, and story descriptions.'}</p><div className="mt-6"><EpisodesSearchBar defaultValue={query} autoFocus={!query} /></div></section>
    {query ? <><nav aria-label="Search result types" className="mx-auto mt-10 flex max-w-4xl gap-1 border-b border-border"><Link href={tabHref('all')} className={`border-b-2 px-3 py-3 text-sm font-medium ${type === 'all' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>All <span className="ml-1 text-xs">{total}</span></Link><Link href={tabHref('series')} className={`border-b-2 px-3 py-3 text-sm font-medium ${type === 'series' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Series <span className="ml-1 text-xs">{seriesResults.length}</span></Link><Link href={tabHref('episodes')} className={`border-b-2 px-3 py-3 text-sm font-medium ${type === 'episodes' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Episodes <span className="ml-1 text-xs">{episodesResults.length}</span></Link></nav>
      {total === 0 ? <div className="py-16"><Empty><EmptyHeader><EmptyTitle>No matches for “{query}”</EmptyTitle><EmptyDescription>Try a shorter title, a different spelling, or search by episode number.</EmptyDescription></EmptyHeader></Empty></div> : <div className="mt-8">{visibleSeries.length > 0 && <section className="mb-12"><div className="mb-5 flex items-end justify-between"><div><h2 className="text-xl font-semibold">Series</h2><p className="mt-1 text-sm text-muted-foreground">Anime you can watch from start to finish.</p></div></div><div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{visibleSeries.map((item) => <SeriesCard key={item.id} series={item} variant="poster" />)}</div></section>}{visibleEpisodes.length > 0 && <section><div className="mb-5"><h2 className="text-xl font-semibold">Episodes</h2><p className="mt-1 text-sm text-muted-foreground">Jump straight into a matching episode.</p></div><div className="flex flex-col gap-3">{visibleEpisodes.map(({ episode, series }) => series && <EpisodeRow key={episode.id} episode={episode} seriesSlug={series.slug} seriesTitle={series.title} />)}</div></section>}{visibleSeries.length === 0 && visibleEpisodes.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">There are no {type} results for this search.</p>}</div>}
    </> : <div className="py-20 text-center"><Empty><EmptyHeader><EmptyTitle>Start with a title or episode</EmptyTitle><EmptyDescription>Use the search field above to explore the catalogue.</EmptyDescription></EmptyHeader></Empty></div>}
  </div></main><SiteFooter /></div>
}
