import { Suspense } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { toISO } from '@/lib/to-iso'
import {
  getAllSeriesWithCreators,
  getSeriesBySlugWithEpisodes,
  getTrendingSeries,
} from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { ExpandableMarkdownSynopsis } from '@/components/episodes/expandable-markdown-synopsis'
import { CreatorCredit } from '@/components/episodes/creator-credit'
import { SeriesEpisodesPanel } from '@/components/episodes/series-episodes-panel'
import { AdSlot } from '@/components/ad-slot'
import { PollPlacement } from '@/components/poll-placement'
import { splitGenres } from '@/lib/genres'
import { GenreTagger } from '@/components/push/genre-tagger'
import type { AnimeScheduleInfo } from '@/lib/animeschedule'
import { SeriesDetails } from '@/components/episodes/series-details'
import { SeriesTabs, type SeriesTab } from '@/components/episodes/series-tabs'
import { SeriesHeroBand } from '@/components/episodes/series-hero-band'
import { ContinueWatchingBar } from '@/components/episodes/continue-watching-bar'
import { SeriesUpcomingPanel } from '@/components/episodes/series-upcoming-panel'
import { RelatedSeriesRow } from '@/components/episodes/related-series-row'
import { TrendingSeriesSection } from '@/components/episodes/trending-series-section'
import { SeriesGridSkeleton } from '@/components/episodes/skeletons'
import { formatReleaseDate } from '@/lib/format-date'
import { selectRelatedSeries } from '@/lib/episode-ui'
import {
  isUpcomingSeries,
  seriesComingLabel,
  seriesStartLabel,
  seriesStatusLabel,
  upcomingEpisodeCount,
} from '@/lib/series-upcoming'

export const revalidate = 3600

interface Props {
  params: Promise<{ 'series-slug': string }>
}

const SITE = 'https://otakunaija.name.ng'

/** A series with no AniList schedule still deserves a details grid. */
function FallbackDetails({
  series,
  airedCount,
  totalEpisodes,
  genres,
}: {
  series: { season?: string | null; seasonYear?: number | null; status?: string | null; format?: string | null }
  airedCount: number
  totalEpisodes: number | null
  genres: string[]
}) {
  const rows: Array<[string, string | null]> = [
    ['Season', series.season ? `${series.season.replace(/^\w/, (c) => c.toUpperCase())}${series.seasonYear ? ` ${series.seasonYear}` : ''}` : series.seasonYear ? String(series.seasonYear) : null],
    ['Status', seriesStatusLabel(series.status)],
    ['Format', series.format ?? null],
    ['Episodes', totalEpisodes && totalEpisodes > airedCount ? `${airedCount} of ${totalEpisodes}` : String(airedCount)],
    ['Genres', genres.length ? genres.join(', ') : null],
  ]
  const visible = rows.filter(([, value]) => Boolean(value)) as Array<[string, string]>
  if (visible.length === 0) return null

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3" data-testid="series-details-fallback">
      {visible.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs uppercase tracking-wide text-[var(--otk-text-dim)]">{label}</dt>
          <dd className="font-semibold text-[var(--otk-text)]">{value}</dd>
        </div>
      ))}
    </dl>
  )
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

  const upcoming = isUpcomingSeries(data.series) || data.series.isPlaceholder
  const description = data.series.synopsis || `Watch ${data.series.title} on OtakuNaija.`

  return {
    title: upcoming ? `${data.series.title} — ${seriesComingLabel(data.series)}` : `${data.series.title}`,
    description,
    alternates: { canonical: `/episodes/${data.series.slug}` },
    // A not-yet-released title has no episodes and no watchable content, so it
    // stays out of the index (and out of the sitemap) until it starts airing.
    ...(upcoming ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: data.series.title,
      description,
      type: 'video.tv_show',
      url: `${SITE}/episodes/${data.series.slug}`,
      images: data.series.coverImageUrl ? [{ url: data.series.coverImageUrl }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: data.series.title,
      description,
      images: data.series.coverImageUrl ? [data.series.coverImageUrl] : [],
    },
  }
}

export default async function SeriesPage({ params }: Props) {
  const { 'series-slug': slug } = await params
  const data = await getSeriesBySlugWithEpisodes(slug)

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-24">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Series Not Found</h1>
            <p className="text-[var(--otk-text-dim)] mb-6">The series you are looking for does not exist.</p>
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
  const upcoming = isUpcomingSeries(series) || series.isPlaceholder
  const announced = upcomingEpisodeCount(series)
  const startLabel = seriesStartLabel(series)
  const comingLabel = seriesComingLabel(series)
  const genres = info?.genres.length ? info.genres.map((g) => g.name) : splitGenres(series.genre)
  const hasWatch = !!info && (info.streams.length > 0 || !!info.jpnTime || !!info.subTime || !!info.dubTime)

  const airedCount = episodes.length
  const totalEpisodes = announced ?? info?.totalEpisodes ?? null
  const studio = info?.studios.map((s) => s.name).join(', ') || null
  const durationLabel =
    series.durationMinutes ? `${series.durationMinutes} min` : info?.lengthMin ? `${info.lengthMin} min` : null

  const episodeRefs = episodes.map((episode) => ({
    slug: episode.slug,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
  }))
  const firstEpisode = episodeRefs[0] ?? null
  const latestEpisode = episodeRefs.length
    ? episodeRefs.reduce((latest, ep) => (ep.episodeNumber > latest.episodeNumber ? ep : latest), episodeRefs[0])
    : null

  // Next airing: the schedule only tells us about release timestamps, so use the
  // soonest one that is still ahead of us. Nothing is invented when none is.
  const now = Date.now()
  const upcomingTimes = [info?.subTime, info?.dubTime, info?.jpnTime]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((entry) => Number.isFinite(entry.time) && entry.time > now)
    .sort((a, b) => a.time - b.time)
  const nextEpisodeLabel = !upcoming && upcomingTimes.length
    ? `Next episode ${formatReleaseDate(upcomingTimes[0].value)}`
    : null

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
    {
      id: 'about',
      label: 'About',
      content: (
        <div className="space-y-6">
          {series.synopsis ? <ExpandableMarkdownSynopsis synopsis={series.synopsis} /> : null}
          {info ? <SeriesDetails info={info} section="about" /> : null}
          <FallbackDetails series={series} airedCount={airedCount} totalEpisodes={totalEpisodes} genres={genres} />
          {creator ? <CreatorCredit creator={creator} /> : null}
        </div>
      ),
    },
    ...(hasWatch ? [{ id: 'watch', label: 'Watch', content: <SeriesDetails info={info!} section="watch" /> }] : []),
    ...(info && info.related.length > 0
      ? [{ id: 'related', label: 'Related', content: <SeriesDetails info={info} section="related" /> }]
      : []),
  ]

  // Rail data: trending for the bottom band, everything else for "More like this".
  const [trendingRows, allSeries] = await Promise.all([
    getTrendingSeries(8).catch(() => []),
    getAllSeriesWithCreators().catch(() => []),
  ])
  const relatedCandidates = (allSeries as Array<{ series: any }>)
    .map((row) => row.series)
    .filter((candidate) => candidate && candidate.slug !== series.slug)
  const relatedCount = selectRelatedSeries(
    { slug: series.slug, genre: series.genre },
    relatedCandidates,
    6,
  ).length
  const trending = (trendingRows as Array<{ series: any; creator?: any }>).filter(
    (row) => row.series.slug !== series.slug,
  )

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Episodes', item: `${SITE}/episodes` },
          { '@type': 'ListItem', position: 3, name: series.title, item: `${SITE}/episodes/${series.slug}` },
        ],
      },
      {
        '@type': 'TVSeries',
        name: series.title,
        description: series.synopsis || '',
        image: series.coverImageUrl || series.posterImageUrl || '',
        genre: genres,
        url: `${SITE}/episodes/${series.slug}`,
        ...(series.startDate
          ? { datePublished: String(series.startDate).slice(0, 10) }
          : info?.premier
            ? { datePublished: info.premier.slice(0, 10) }
            : {}),
        ...(totalEpisodes ? { numberOfEpisodes: totalEpisodes } : airedCount ? { numberOfEpisodes: airedCount } : {}),
        ...(studio ? { productionCompany: { '@type': 'Organization', name: studio } } : {}),
        ...(hasWatch && firstEpisode
          ? {
              potentialAction: {
                '@type': 'WatchAction',
                target: `${SITE}/episodes/${series.slug}/${firstEpisode.slug}`,
              },
            }
          : {}),
      },
    ],
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GenreTagger genre={series.genre} />
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-border/40 px-4 py-2.5 md:px-6">
        <ol className="mx-auto flex max-w-7xl items-center gap-2 text-xs text-[var(--otk-text-dim)]">
          <li>
            <Link href="/" className="hover:text-[var(--otk-text)]">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/episodes" className="hover:text-[var(--otk-text)]">
              Episodes
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate text-[var(--otk-text)]" aria-current="page">
            {series.title}
          </li>
        </ol>
      </nav>

      <SeriesHeroBand
        series={series}
        airedCount={airedCount}
        totalEpisodes={totalEpisodes}
        studio={studio}
        genres={genres}
        nextEpisodeLabel={nextEpisodeLabel}
        durationLabel={durationLabel}
        firstEpisode={firstEpisode}
        latestEpisode={latestEpisode}
        upcoming={upcoming}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {!upcoming ? (
          <div className="mb-6">
            <ContinueWatchingBar seriesSlug={series.slug} />
          </div>
        ) : null}

        {info?.delayText ? <div className="mb-6"><SeriesDetails info={info} section="banner" /></div> : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-10">
            {upcoming ? (
              <div className="space-y-6">
                <SeriesUpcomingPanel
                  seriesSlug={series.slug}
                  seriesTitle={series.title}
                  comingLabel={comingLabel}
                  startLabel={startLabel}
                  startDate={series.startDate ? String(series.startDate) : null}
                  format={series.format}
                  episodesTotal={announced}
                  trailerSite={series.trailerSite}
                  trailerId={series.trailerId}
                  shareUrl={`/episodes/${series.slug}`}
                />
                {series.synopsis ? (
                  <section className="otk-panel otk-panel-pad" aria-labelledby="series-synopsis-heading">
                    <h2 id="series-synopsis-heading" className="otk-aside-title mb-3">
                      About this series
                    </h2>
                    <ExpandableMarkdownSynopsis synopsis={series.synopsis} />
                    <div className="mt-5">
                      <FallbackDetails
                        series={series}
                        airedCount={airedCount}
                        totalEpisodes={totalEpisodes}
                        genres={genres}
                      />
                    </div>
                    {creator ? <div className="mt-5"><CreatorCredit creator={creator} /></div> : null}
                  </section>
                ) : null}
              </div>
            ) : (
              <SeriesTabs tabs={tabs} />
            )}

            {relatedCount > 0 ? (
              <RelatedSeriesRow current={{ slug: series.slug, genre: series.genre }} candidates={relatedCandidates} />
            ) : null}
          </div>

          <aside className="otk-aside" aria-label="Series sidebar">
            <PollPlacement source="series" />
            <section id="newsletter" className="otk-aside-section scroll-mt-24">
              <h2 className="otk-aside-title">Weekly anime drops</h2>
              <p className="text-sm text-[var(--otk-text-dim)]">
                New episodes from {creator?.name || 'your favourite creators'}, once a week.
              </p>
              <NewsletterSignup />
            </section>
            <AdSlot slot="sidebar" label="Advertisement" />
          </aside>
        </div>

        <div className="mt-12 space-y-10">
          <Suspense
            fallback={
              <div className="otk-section-floor">
                <SeriesGridSkeleton count={8} />
              </div>
            }
          >
            <TrendingSeriesSection trendingSeries={trending} />
          </Suspense>
          <AdSlot slot="footer" label="footer" />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
