import { Metadata } from 'next'
import { toISO } from '@/lib/to-iso'
import Image from 'next/image'
import Link from 'next/link'
import { getSeriesBySlugWithEpisodes } from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { ExpandableMarkdownSynopsis } from '@/components/episodes/expandable-markdown-synopsis'
import { CreatorCredit } from '@/components/episodes/creator-credit'
import { SeriesEpisodesPanel } from '@/components/episodes/series-episodes-panel'
import { AdSlot } from '@/components/ad-slot'
import { Calendar, Play } from 'lucide-react'
import { PollPlacement } from '@/components/poll-placement'
import { splitGenres } from '@/lib/genres'
import { GenreTagger } from '@/components/push/genre-tagger'
import type { AnimeScheduleInfo } from '@/lib/animeschedule'
import { SeriesDetails } from '@/components/episodes/series-details'
import { SeriesTabs, type SeriesTab } from '@/components/episodes/series-tabs'
import { SeriesTitleLogo } from '@/components/episodes/series-title-logo'
import { getSeriesLogo } from '@/lib/tmdb/reader'
import {
  isUpcomingSeries,
  seriesComingLabel,
  seriesStartLabel,
  seriesStatusClass,
  seriesStatusLabel,
  seriesTrailerUrl,
  upcomingEpisodeCount,
} from '@/lib/series-upcoming'

export const revalidate = 3600

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

  const upcoming = isUpcomingSeries(data.series)

  return {
    title: upcoming ? `${data.series.title} — ${seriesComingLabel(data.series)}` : `${data.series.title}`,
    description: data.series.synopsis || `Watch ${data.series.title} on OtakuNaija.`,
    alternates: { canonical: `/episodes/${data.series.slug}` },
    // A not-yet-released title has no episodes and no watchable content, so it
    // stays out of the index (and out of the sitemap) until it starts airing.
    ...(upcoming ? { robots: { index: false, follow: true } } : {}),
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
  const info = (series.animescheduleData as AnimeScheduleInfo | null) ?? null
  const upcoming = isUpcomingSeries(series)
  const upcomingEpisodes = upcomingEpisodeCount(series)
  const startLabel = seriesStartLabel(series)
  const trailerUrl = seriesTrailerUrl(series)
  const logo = getSeriesLogo(series)
  const latestEp = episodes.reduce((m, e) => Math.max(m, e.episodeNumber), 0)
  const episodeCount = info?.totalEpisodes ?? upcomingEpisodes ?? (latestEp || episodes.length)
  const year = info?.year ?? (series.createdAt ? new Date(series.createdAt).getFullYear() : null)
  const genres = info?.genres.length ? info.genres.map((g) => g.name) : splitGenres(series.genre)
  const hasWatch = !!info && (info.streams.length > 0 || !!info.jpnTime || !!info.subTime || !!info.dubTime)
  const tabs: SeriesTab[] = [
    {
      id: 'episodes',
      label: 'Episodes',
      content: (
        <SeriesEpisodesPanel
          episodes={episodes.map((episode) => ({
            ...episode,
            publishedAt: toISO(episode.publishedAt),
          }))}
          seriesSlug={series.slug}
          synopsis={series.synopsis}
        />
      ),
    },
    ...(info ? [{ id: 'about', label: 'About', content: <SeriesDetails info={info} section="about" /> }] : []),
    ...(hasWatch ? [{ id: 'watch', label: 'Watch', content: <SeriesDetails info={info!} section="watch" /> }] : []),
    ...(info && info.related.length > 0
      ? [{ id: 'related', label: 'Related', content: <SeriesDetails info={info} section="related" /> }]
      : []),
  ]

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GenreTagger genre={series.genre} />
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
                genre: genres,
                ...(info?.premier ? { datePublished: info.premier.slice(0, 10) } : {}),
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
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          {info?.posterColor && /^\d{1,3} \d{1,3} \d{1,3}$/.test(info.posterColor) && (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to right, rgb(${info.posterColor} / 0.45), transparent 70%)` }}
          />
        )}
        <div className="absolute inset-0 flex items-end px-4 pb-4 md:px-6 md:pb-6">
          <div className="mx-auto flex w-full max-w-7xl items-end gap-3 md:gap-4">
            {series.posterImageUrl && (
              <div className="relative h-32 w-[88px] flex-shrink-0 overflow-hidden rounded-lg border-2 border-border shadow-lg sm:h-40 sm:w-28 md:h-52 md:w-36">
                <Image src={series.posterImageUrl} alt={`${series.title} poster`} fill className="object-cover" sizes="(min-width: 768px) 144px, 96px" />
              </div>
            )}
            <div className="min-w-0 space-y-2 md:space-y-3">
              <SeriesTitleLogo logo={logo} title={series.title} />
              <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl md:text-3xl">{series.title}</h1>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`otk-chip ${seriesStatusClass(series.status)}`}
                  data-testid="series-status-chip"
                  style={{ position: 'static' }}
                >
                  {seriesStatusLabel(series.status)}
                </span>
                {info?.stats && (
                  <span className="rounded-full bg-black/50 px-2.5 py-0.5 text-[11px] font-medium text-white">
                    ★ {info.stats.score.toFixed(1)}
                  </span>
                )}
                {genres.slice(0, 6).map((g) => (
                  <Link key={g} href={`/episodes/browse?genre=${encodeURIComponent(g)}`}
                    className="rounded-full bg-primary/90 px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary">
                    {g}
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/70">
                {upcoming ? (
                  <span className="inline-flex items-center gap-1.5" data-testid="series-coming-line">
                    <Calendar className="h-3.5 w-3.5" /> {seriesComingLabel(series)}
                  </span>
                ) : (
                  <>
                    {year && <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {year}{info && series.status === 'ongoing' ? ' – Present' : ''}</span>}
                    <span className="inline-flex items-center gap-1.5"><Play className="h-3.5 w-3.5" /> {episodeCount.toLocaleString('en-NG')} Episode{episodeCount !== 1 ? 's' : ''}</span>
                  </>
                )}
                {trailerUrl && (
                  <a
                    href={trailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="otk-focus inline-flex items-center gap-1.5 underline decoration-dotted underline-offset-2 hover:text-foreground"
                  >
                    <Play className="h-3.5 w-3.5" /> Watch trailer
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 md:px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-8">
            {/* Synopsis */}
            {series.synopsis && (
              <div>
                <ExpandableMarkdownSynopsis synopsis={series.synopsis} />
              </div>
            )}

            {info && <SeriesDetails info={info} section="banner" />}

            {/* Creator Credit */}
            {creator && <CreatorCredit creator={creator} />}

            {/* An upcoming series has nothing to play yet: no episodes panel with
                zero rows, just where it stands and when it lands. */}
            {upcoming ? (
              <section
                className="rounded-xl border border-border bg-card p-5"
                data-testid="series-upcoming-panel"
                aria-labelledby="series-upcoming-heading"
              >
                <h2 id="series-upcoming-heading" className="text-base font-bold text-foreground">
                  {seriesComingLabel(series)}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {series.synopsis
                    ? 'Episodes will appear here as soon as the first one airs.'
                    : 'This title has been announced. Episodes will appear here when it starts airing.'}
                </p>
                <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground/70">
                  <div className="flex gap-1.5">
                    <dt className="font-semibold">Release</dt>
                    <dd>{startLabel}</dd>
                  </div>
                  {upcomingEpisodes ? (
                    <div className="flex gap-1.5">
                      <dt className="font-semibold">Episodes announced</dt>
                      <dd>{upcomingEpisodes}</dd>
                    </div>
                  ) : null}
                  {series.format ? (
                    <div className="flex gap-1.5">
                      <dt className="font-semibold">Format</dt>
                      <dd>{series.format}</dd>
                    </div>
                  ) : null}
                </dl>
                {trailerUrl ? (
                  <a
                    href={trailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="otk-pill otk-focus mt-4 inline-flex"
                    data-testid="series-trailer-link"
                  >
                    Watch trailer
                  </a>
                ) : null}
              </section>
            ) : (
              <SeriesTabs tabs={tabs} />
            )}
          </div>

          {/* Sidebar (desktop) */}
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
              <div className="hidden lg:block">
              <PollPlacement source="series" />
            </div>
            <section id="newsletter" className="scroll-mt-24 rounded-xl border border-border bg-card p-5">
              <h3 className="mb-2 text-base font-bold text-foreground">Get weekly anime drops, straight to your inbox.</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Subscribe to stay updated on new episodes from {creator?.name || 'your favorite creators'}.
              </p>
              <NewsletterSignup />
            </section>
            <AdSlot slot="sidebar" label="Advertisement" />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
