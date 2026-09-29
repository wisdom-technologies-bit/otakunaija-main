import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewReleasesRow } from '@/components/episodes/new-releases-row'
import { CatalogPagination } from '@/components/episodes/catalog-pagination'
import { getPaginatedNewEpisodes } from '@/lib/db/queries'

export const metadata: Metadata = { title: 'New Episodes', description: 'Watch the latest anime episodes on OtakuNaija.', alternates: { canonical: '/episodes/new-releases' } }

type Props = { searchParams: Promise<{ page?: string }> }

export default async function NewReleasesPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const catalog = await getPaginatedNewEpisodes(page)
  const makeHref = (nextPage: number) => `/episodes/new-releases?page=${nextPage}`
  return <div className="flex min-h-dvh flex-col bg-background"><SiteHeader /><main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-12"><div className="mb-8"><h1 className="text-3xl font-bold text-foreground md:text-4xl">New Episodes</h1><p className="mt-2 text-muted-foreground">The latest releases from every series.</p></div><div className="flex flex-col gap-6">{catalog.items.map(({ episode, series }) => series ? <NewReleasesRow key={episode.id} items={[{ episode, series }]} /> : null)}</div><CatalogPagination page={catalog.page} totalPages={catalog.totalPages} makeHref={makeHref} /></main><SiteFooter /></div>
}
