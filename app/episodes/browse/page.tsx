import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { SeriesCard } from '@/components/episodes/series-card'
import { EpisodesFilterPills } from '@/components/episodes/episodes-filter-pills'
import { CatalogPagination } from '@/components/episodes/catalog-pagination'
import { getAllUsedGenres, getPaginatedSeries, getLatestEpisodeNumber } from '@/lib/db/queries'

export const metadata: Metadata = { title: 'Browse All Anime', description: 'Browse all anime series on OtakuNaija.', alternates: { canonical: '/episodes/browse' } }

type Props = { searchParams: Promise<{ status?: string; genre?: string; page?: string; sort?: string }> }

export default async function BrowsePage({ searchParams }: Props) {
  const params = await searchParams
  const status = ['ongoing', 'completed', 'upcoming'].includes(params.status ?? '') ? params.status : undefined
  const genre = params.genre
  const sort = params.sort === 'title' ? 'title' : 'newest'
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const [catalog, genres] = await Promise.all([getPaginatedSeries({ page, status, genre, sort }), getAllUsedGenres()])
  const items = await Promise.all(catalog.items.map(async (item) => ({ ...item, episodeCount: await getLatestEpisodeNumber(item.series.id) })))
  const makeHref = (nextPage: number) => {
    const query = new URLSearchParams()
    if (status) query.set('status', status)
    if (genre) query.set('genre', genre)
    if (sort !== 'newest') query.set('sort', sort)
    query.set('page', String(nextPage))
    return `/episodes/browse?${query}`
  }
  return <div className="flex min-h-dvh flex-col bg-background"><SiteHeader /><main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-12"><div className="mb-8"><h1 className="text-3xl font-bold text-foreground md:text-4xl">Browse All Anime</h1><p className="mt-2 text-muted-foreground">Explore every series in the OtakuNaija catalog.</p></div><div className="mb-5 flex flex-wrap gap-2"><a href="/episodes/browse" className={!status ? 'rounded-full border border-primary bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary' : 'rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground/80'}>All</a>{['ongoing', 'completed', 'upcoming'].map((value) => <a key={value} href={`/episodes/browse?${new URLSearchParams({ ...(genre ? { genre } : {}), ...(sort !== 'newest' ? { sort } : {}), status: value })}`} className={status === value ? 'rounded-full border border-primary bg-primary/10 px-4 py-1.5 text-sm font-medium capitalize text-primary' : 'rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium capitalize text-foreground/80'}>{value}</a>)}</div><div className="mb-8"><EpisodesFilterPills genres={genres} activeGenre={genre} activeStatus={status} basePath="/episodes/browse" /></div><div className="mb-6 flex items-center justify-between text-sm text-muted-foreground"><span>{catalog.total} series</span><div className="flex gap-2"><a href={makeHref(1)} className={sort === 'newest' ? 'font-medium text-primary' : 'hover:text-primary'}>Newest</a><span>/</span><a href={`/episodes/browse?${new URLSearchParams({ ...(status ? { status } : {}), ...(genre ? { genre } : {}), sort: 'title', page: '1' })}`} className={sort === 'title' ? 'font-medium text-primary' : 'hover:text-primary'}>Title</a></div></div>{items.length ? <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 xl:grid-cols-5">{items.map(({ series, creator, episodeCount }) => <SeriesCard key={series.id} series={{ ...series, episodeCount }} creatorName={creator?.name ?? undefined} variant="poster" />)}</div> : <p className="rounded-lg border border-border/40 bg-card/40 p-12 text-center text-muted-foreground">No series match these filters.</p>}<CatalogPagination page={catalog.page} totalPages={catalog.totalPages} makeHref={makeHref} /></main><SiteFooter /></div>
}
