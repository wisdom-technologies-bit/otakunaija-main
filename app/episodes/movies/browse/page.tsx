import type { Metadata } from 'next'
import { getPaginatedVideos } from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { CatalogHeader } from '@/components/episodes/catalog-header'
import { CatalogToolbar } from '@/components/episodes/catalog-toolbar'
import { CatalogPagination } from '@/components/episodes/catalog-pagination'
import { MovieCard } from '@/components/episodes/movie-card'
import { buildHref } from '@/lib/listing-url'

export const metadata: Metadata = { title: 'Movies, OVAs & Specials' }

const BASE = '/episodes/movies/browse'
const TYPE_LABEL: Record<string, string> = { all: 'titles', movie: 'movies', ova: 'OVAs', special: 'specials' }

export default async function MoviesBrowsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page || 1) || 1)
  const rawType = typeof params.contentType === 'string' ? params.contentType : undefined
  const type = rawType && ['movie', 'ova', 'special'].includes(rawType) ? rawType : undefined
  const { items, total, pageSize } = await getPaginatedVideos({ page, contentType: type })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const makeHref = (nextPage: number) => buildHref(BASE, { contentType: type, page }, { page: nextPage })
  const countLabel = `${total} ${TYPE_LABEL[type ?? 'all']}`

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="otk-page mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-12">
        <CatalogHeader
          eyebrow="OtakuNaija cinema"
          title="Movies, OVAs & Specials"
          description="Feature films, OVAs and specials from the catalog, in the same poster format as the series pages."
          count={countLabel}
        />

        <CatalogToolbar
          basePath={BASE}
          params={{ contentType: type }}
          statusKey="contentType"
          statusLabel="Type"
          statusOptions={[
            { value: 'all', label: 'All' },
            { value: 'movie', label: 'Movies' },
            { value: 'ova', label: 'OVAs' },
            { value: 'special', label: 'Specials' },
          ]}
        />

        <div className="mt-6">
          {items.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {items.map(({ video }) => (
                <MovieCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <div className="otk-empty">
              <p className="text-lg font-bold text-[var(--otk-text)]">No titles match these filters</p>
              <p className="max-w-md text-sm text-[var(--otk-text-dim)]">
                Try another content type to see the full cinema catalog.
              </p>
              <a href={BASE} className="otk-pill otk-focus mt-2">
                Clear filters
              </a>
            </div>
          )}
        </div>

        <CatalogPagination page={page} totalPages={totalPages} makeHref={makeHref} />
      </main>
      <SiteFooter />
    </div>
  )
}
