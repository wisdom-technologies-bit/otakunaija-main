import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { SeriesCard } from '@/components/episodes/series-card'
import { CatalogHeader } from '@/components/episodes/catalog-header'
import { CatalogToolbar } from '@/components/episodes/catalog-toolbar'
import { CatalogPagination } from '@/components/episodes/catalog-pagination'
import { getAllUsedGenres, getPaginatedSeries, getLatestEpisodeNumber } from '@/lib/db/queries'
import { buildHref } from '@/lib/listing-url'
import './../../listings.css'

export const metadata: Metadata = { title: 'Browse All Anime', description: 'Browse all anime series on OtakuNaija.', alternates: { canonical: '/episodes/browse' } }

const BASE = '/episodes/browse'

type Props = { searchParams: Promise<{ status?: string; genre?: string; page?: string; sort?: string }> }

export default async function BrowsePage({ searchParams }: Props) {
  const params = await searchParams
  const status = ['ongoing', 'completed', 'upcoming'].includes(params.status ?? '') ? params.status : undefined
  const genre = params.genre
  const sort = params.sort === 'title' ? 'title' : 'newest'
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const [catalog, genres] = await Promise.all([getPaginatedSeries({ page, status, genre, sort }), getAllUsedGenres()])
  const items = await Promise.all(catalog.items.map(async (item) => ({ ...item, episodeCount: await getLatestEpisodeNumber(item.series.id) })))
  const makeHref = (nextPage: number) => buildHref(BASE, { status, genre, sort, page }, { page: nextPage })
  const titleStatus = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'
  const titleGenre = genre ? `${genre} ` : ''

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main className="otk-page mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-12">
        <CatalogHeader
          eyebrow="Anime catalog"
          title="Browse all anime"
          description="Every series on OtakuNaija, filterable by status and genre. Pick a poster to see its episode list."
          count={`${catalog.total} ${titleGenre}${titleStatus === 'All' ? '' : `${titleStatus.toLowerCase()} `}series`}
        />

        <CatalogToolbar
          basePath={BASE}
          params={{ status, genre, sort }}
          statusKey="status"
          statusLabel="Status"
          statusOptions={[
            { value: 'all', label: 'All' },
            { value: 'ongoing', label: 'Ongoing' },
            { value: 'completed', label: 'Completed' },
            { value: 'upcoming', label: 'Upcoming' },
          ]}
          genres={genres}
          genreLabel="Genre"
          sortOptions={[
            { value: 'newest', label: 'Newest' },
            { value: 'title', label: 'Title' },
          ]}
          sortLabel="Sort"
        />

        <div className="mt-6">
          {items.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map(({ series, creator, episodeCount }) => (
                <SeriesCard
                  key={series.id}
                  series={{ ...series, episodeCount }}
                  creatorName={creator?.name ?? undefined}
                  variant="poster"
                />
              ))}
            </div>
          ) : (
            <div className="otk-empty">
              <p className="text-lg font-bold text-[var(--otk-text)]">No titles match these filters</p>
              <p className="max-w-md text-sm text-[var(--otk-text-dim)]">
                Try removing the genre or status filter to see the whole catalog.
              </p>
              <a href={BASE} className="otk-pill otk-focus mt-2">
                Clear filters
              </a>
            </div>
          )}
        </div>

        <CatalogPagination page={catalog.page} totalPages={catalog.totalPages} makeHref={makeHref} />
      </main>
      <SiteFooter />
    </div>
  )
}
