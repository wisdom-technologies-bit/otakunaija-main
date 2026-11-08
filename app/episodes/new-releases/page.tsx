import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { EpisodeDayList } from '@/components/episodes/episode-day-list'
import { CatalogHeader } from '@/components/episodes/catalog-header'
import { CatalogPagination } from '@/components/episodes/catalog-pagination'
import { getPaginatedNewEpisodes } from '@/lib/db/queries'
import { toISO } from '@/lib/to-iso'
import './../../listings.css'

export const metadata: Metadata = { title: 'New Episodes', description: 'Watch the latest anime episodes on OtakuNaija.', alternates: { canonical: '/episodes/new-releases' } }

type Props = { searchParams: Promise<{ page?: string }> }

export default async function NewReleasesPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const catalog = await getPaginatedNewEpisodes(page)
  const makeHref = (nextPage: number) => `/episodes/new-releases?page=${nextPage}`
  const now = Date.now()

  const items = catalog.items
    .filter((entry) => entry.series)
    .map(({ episode, series }) => ({
      episode: {
        id: episode.id,
        slug: episode.slug,
        title: episode.title,
        episodeNumber: episode.episodeNumber,
        thumbnailUrl: episode.thumbnailUrl,
        durationSeconds: episode.durationSeconds,
        publishedAt: toISO(episode.publishedAt),
      },
      series: series ? { slug: series.slug, title: series.title } : null,
    }))

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main className="otk-page mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-12">
        <CatalogHeader
          eyebrow="Release schedule"
          title="New episodes"
          description="Every episode published across the catalog, newest first and grouped by day."
          count={`${catalog.total} episode${catalog.total === 1 ? '' : 's'} · ${items.length} on this page`}
        />

        {items.length > 0 ? (
          <EpisodeDayList items={items} now={now} />
        ) : (
          <div className="otk-empty">
            <p className="text-lg font-bold text-[var(--otk-text)]">No episodes published yet</p>
            <p className="max-w-md text-sm text-[var(--otk-text-dim)]">
              New releases appear here as soon as they go live.
            </p>
          </div>
        )}

        <CatalogPagination page={catalog.page} totalPages={catalog.totalPages} makeHref={makeHref} />
      </main>
      <SiteFooter />
    </div>
  )
}
