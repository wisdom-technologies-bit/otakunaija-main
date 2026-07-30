import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getSeriesBySlugWithEpisodes } from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { EpisodeRow } from '@/components/episodes/episode-row'
import { CreatorCredit } from '@/components/episodes/creator-credit'
import { ExpandableMarkdownSynopsis } from '@/components/episodes/expandable-markdown-synopsis'
import { SeriesEpisodesPanel } from '@/components/episodes/series-episodes-panel'
import { Calendar, Play, Tag } from 'lucide-react'

interface Props {
  params: Promise<{ 'series-slug': string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { 'series-slug': slug } = await params
  const data = await getSeriesBySlugWithEpisodes(slug)

  if (!data) {
    return {
      title: 'Series Not Found',
      description: 'The series you are looking for could not be found.',
    }
  }

  return {
    title: `${data.series.title}`,
    description: data.series.synopsis || `Watch ${data.series.title} on OtakuNaija.`,
    alternates: { canonical: `/episodes/${data.series.slug}` },
    openGraph: {
      title: data.series.title,
      description: data.series.synopsis || `Watch ${data.series.title} on OtakuNaija.`,
      images: data.series.coverImageUrl ? [{ url: data.series.coverImageUrl }] : [],
    },
  }
}

export default async function SeriesPage({ params }: Props) {
  const { 'series-slug': slug } = await params
  const data = await getSeriesBySlugWithEpisodes(slug)

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Series Not Found</h1>
            <p className="text-foreground/70 mb-6">The series you are looking for does not exist.</p>
            <Link href="/episodes" className="text-primary hover:underline">
              ← Back to Episodes
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    )
  }

  const { series, creator, episodes } = data
  const episodeCount = episodes.length
  const year = series.createdAt ? new Date(series.createdAt).getFullYear() : null

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* JSON-LD for BreadcrumbList and TVSeries */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://otakunaija.name.ng/' },
                  { '@type': 'ListItem', position: 2, name: 'Episodes', item: 'https://otakunaija.name.ng/episodes' },
                  {
                    '@type': 'ListItem',
                    position: 3,
                    name: series.title,
                    item: `https://otakunaija.name.ng/episodes/${series.slug}`,
                  },
                ],
              },
              {
                '@type': 'TVSeries',
                name: series.title,
                description: series.synopsis || '',
                image: series.coverImageUrl || '',
                genre: series.genre ? [series.genre] : [],
                numberOfEpisodes: episodeCount,
                containsSeason: [{ '@type': 'TVSeason', name: 'Season 1', numberOfEpisodes: episodeCount }],
              },
            ],
          }),
        }}
      />

      {/* Breadcrumb */}
      <div className="border-b border-border/40 px-4 md:px-6 py-3">
        <div className="mx-auto max-w-7xl text-sm text-foreground/70">
          <Link href="/episodes" className="hover:text-primary transition-colors">
            Episodes
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{series.title}</span>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative h-72 w-full overflow-hidden bg-muted md:h-96">
        {series.coverImageUrl && (
          <Image src={series.coverImageUrl} alt={series.title} fill className="object-cover" priority />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        <div className="absolute inset-0 flex items-end p-4 md:p-6">
          <div className="mx-auto flex w-full max-w-7xl items-end gap-4">
            {series.posterImageUrl && (
              <div className="relative hidden h-40 w-28 flex-shrink-0 overflow-hidden rounded-lg border-2 border-border shadow-lg sm:block md:h-52 md:w-36">
                <Image src={series.posterImageUrl} alt={`${series.title} poster`} fill className="object-cover" />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground md:text-3xl">{series.title}</h1>
                {series.genre && (
                  <span className="rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground">
                    {series.genre}
                  </span>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium text-white ${
                    series.status === 'ongoing' ? 'bg-emerald-900/70' : 'bg-slate-900/70'
                  }`}
                >
                  {series.status === 'ongoing' ? 'Ongoing' : 'Completed'}
                </span>
              </div>

              {/* Quick Info row — only real data */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-foreground/70">
                {year && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> {year}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5" /> {episodeCount} Episode{episodeCount !== 1 ? 's' : ''}
                </span>
                {series.genre && (
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> {series.genre}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 md:px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            {/* Mobile Series Header with Poster */}
            <div className="sm:hidden space-y-4">
              <div className="flex gap-4">
                {series.posterImageUrl && (
                  <div className="relative h-32 w-24 flex-shrink-0 overflow-hidden rounded border border-border/60 bg-muted" style={{ aspectRatio: '9/16' }}>
                    <Image src={series.posterImageUrl} alt={`${series.title} poster`} fill className="object-cover" sizes="96px" />
                  </div>
                )}
                
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground">{series.title}</h1>
                  </div>
                  
                  {/* Genre badges */}
                  <div className="flex flex-wrap gap-2">
                    {series.genre && (
                      <span className="rounded-full bg-primary/90 px-2.5 py-1 text-xs font-medium text-primary-foreground">
                        {series.genre}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium text-white ${
                        series.status === 'ongoing' ? 'bg-emerald-900/70' : 'bg-slate-900/70'
                      }`}
                    >
                      {series.status === 'ongoing' ? 'Ongoing' : 'Completed'}
                    </span>
                  </div>
                  
                  {/* Quick stats */}
                  <div className="text-xs text-foreground/70 space-y-1">
                    {year && <div><span className="font-medium">{year}</span> • Year</div>}
                    <div><span className="font-medium">{episodeCount}</span> Episodes</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Synopsis */}
            {series.synopsis && (
              <div>
                <ExpandableMarkdownSynopsis synopsis={series.synopsis} />
              </div>
            )}

            {/* Creator Credit */}
            {creator && <CreatorCredit creator={creator} />}

            {/* Episodes panel with tabs + sort */}
            <SeriesEpisodesPanel
              episodes={episodes}
              seriesSlug={series.slug}
              synopsis={series.synopsis}
            />
          </div>

          {/* Sidebar (desktop) */}
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            {series.synopsis && (
              <section className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-2 text-base font-bold text-foreground">About {series.title}</h3>
                <p className="line-clamp-6 text-sm leading-relaxed text-foreground/70">{series.synopsis}</p>
              </section>
            )}

            <section className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-base font-bold text-foreground">Quick Info</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium text-foreground">
                    {series.status === 'ongoing' ? 'Ongoing' : 'Completed'}
                  </dd>
                </div>
                {series.genre && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Genre</dt>
                    <dd className="font-medium text-foreground">{series.genre}</dd>
                  </div>
                )}
                {year && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Year</dt>
                    <dd className="font-medium text-foreground">{year}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Episodes</dt>
                  <dd className="font-medium text-foreground">{episodeCount}</dd>
                </div>
              </dl>
            </section>

            <section id="newsletter" className="scroll-mt-24 rounded-xl border border-border bg-card p-5">
              <h3 className="mb-2 text-base font-bold text-foreground">
                Get weekly anime drops, straight to your inbox.
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Subscribe to stay updated on new episodes from {creator?.name || 'your favorite creators'}.
              </p>
              <NewsletterSignup />
            </section>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
