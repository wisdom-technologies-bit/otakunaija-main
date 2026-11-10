import { Suspense } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import {
  getEpisodeBySlugWithContext,
  getPreviousAndNextEpisode,
  getEpisodesBySeries,
  getTrendingSeries,
  getLatestEpisodeNumber,
} from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { VideoPlayer } from '@/components/episodes/video-player-client'
import { WatchProgressTracker } from '@/components/episodes/watch-progress-tracker'
import { CreatorCredit } from '@/components/episodes/creator-credit'
import { EpisodeNavigation } from '@/components/episodes/episode-navigation'
import { EpisodeTracker } from '@/components/episodes/episode-tracker'
import { formatPublishedDate, formatDuration, formatViewCount } from '@/lib/episode-utils'
import { ExpandableSynopsis } from '@/components/episodes/expandable-synopsis'
import { LiveViewerWidget } from '@/components/episodes/live-viewer-widget'
import { AboutSeriesSidebar } from '@/components/episodes/about-series-sidebar'
import { TrendingSeriesSection } from '@/components/episodes/trending-series-section'
import { PollPlacement } from '@/components/poll-placement'
import { toISO } from '@/lib/to-iso'
import { GenreTagger } from '@/components/push/genre-tagger'
import { SeriesLogo } from '@/components/episodes/series-logo'
import { ShareButton } from '@/components/episodes/share-button'
import { UpNextList, type UpNextEpisode } from '@/components/episodes/up-next-list'
import { SeriesGridSkeleton } from '@/components/episodes/skeletons'

export const revalidate = 3600

interface Props {
  params: Promise<{ 'series-slug': string; 'episode-slug': string }>
}

const SITE = 'https://otakunaija.name.ng'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { 'episode-slug': episodeSlug } = await params
  const data = await getEpisodeBySlugWithContext(episodeSlug)

  if (!data) {
    return {
      title: 'Episode Not Found',
      description: 'The episode you are looking for could not be found.',
    }
  }

  const { episode, series } = data
  const seriesSlugValue = series?.slug ?? ''
  const description =
    episode.synopsis ||
    `Watch ${episode.title} on OtakuNaija. Episode ${episode.episodeNumber} of ${series?.title || 'the series'}.`

  return {
    title: `${episode.title} — ${series?.title || 'Episode'}`,
    alternates: { canonical: `/episodes/${seriesSlugValue}/${episode.slug}` },
    description,
    openGraph: {
      title: `${episode.title} — ${series?.title}`,
      description,
      url: `${SITE}/episodes/${seriesSlugValue}/${episode.slug}`,
      images: episode.thumbnailUrl ? [{ url: episode.thumbnailUrl }] : [],
      type: 'video.other',
    },
    twitter: {
      card: 'player',
      title: `${episode.title} — ${series?.title}`,
      description: episode.synopsis ?? undefined,
      images: episode.thumbnailUrl ? [episode.thumbnailUrl] : [],
    },
  }
}

export default async function WatchPage({ params }: Props) {
  const { 'series-slug': seriesSlug, 'episode-slug': episodeSlug } = await params
  const episodeData = await getEpisodeBySlugWithContext(episodeSlug)

  if (!episodeData) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-24">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Episode Not Found</h1>
            <p className="text-[var(--otk-text-dim)] mb-6">The episode you are looking for does not exist.</p>
            <Link href={`/episodes/${seriesSlug}`} className="text-primary hover:underline">
              ← Back to Series
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    )
  }

  const { episode, series, creator } = episodeData

  if (!series) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-24">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Series Not Found</h1>
            <p className="text-[var(--otk-text-dim)] mb-6">The series for this episode could not be found.</p>
            <Link href="/episodes" className="text-primary hover:underline">
              ← Back to Episodes
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    )
  }

  const [navData, allEpisodes, episodeCount, trendingSeriesData] = await Promise.all([
    getPreviousAndNextEpisode(series.id, episode.episodeNumber),
    getEpisodesBySeries(series.id),
    getLatestEpisodeNumber(series.id),
    getTrendingSeries(12).catch(() => []),
  ])

  const episodeCanonicalUrl = `${SITE}/episodes/${seriesSlug}/${episode.slug}`

  // "Up next": the current episode plus the next four, so the list shows where
  // the viewer is without turning into a second episode browser.
  const ordered = [...allEpisodes].sort((a, b) => a.episodeNumber - b.episodeNumber)
  const currentIndex = ordered.findIndex((item) => item.id === episode.id)
  const windowStart = Math.max(0, currentIndex === -1 ? 0 : currentIndex - 1)
  const upNext: UpNextEpisode[] = ordered.slice(windowStart, windowStart + 5).map((item) => ({
    id: item.id,
    slug: item.slug,
    episodeNumber: item.episodeNumber,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl ?? null,
    durationSeconds: item.durationSeconds ?? null,
  }))

  const airDate = episode.publishedAt ? formatPublishedDate(episode.publishedAt) : null
  const duration = episode.durationSeconds ? formatDuration(episode.durationSeconds) : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Episodes', item: `${SITE}/episodes` },
          { '@type': 'ListItem', position: 3, name: series.title, item: `${SITE}/episodes/${seriesSlug}` },
          {
            '@type': 'ListItem',
            position: 4,
            name: `Episode ${episode.episodeNumber}`,
            item: episodeCanonicalUrl,
          },
        ],
      },
      {
        '@type': 'TVEpisode',
        name: episode.title,
        episodeNumber: episode.episodeNumber,
        description: episode.synopsis || `Watch ${episode.title} on OtakuNaija.`,
        image: episode.thumbnailUrl,
        url: episodeCanonicalUrl,
        ...(episode.publishedAt ? { datePublished: toISO(episode.publishedAt) } : {}),
        ...(episode.durationSeconds ? { duration: `PT${Math.round(episode.durationSeconds / 60)}M` } : {}),
        partOfSeries: {
          '@type': 'TVSeries',
          name: series.title,
          url: `${SITE}/episodes/${seriesSlug}`,
        },
      },
      {
        '@type': 'VideoObject',
        name: episode.title,
        description: episode.synopsis || `Watch ${episode.title} on OtakuNaija.`,
        thumbnailUrl: [episode.thumbnailUrl],
        uploadDate: toISO(episode.publishedAt),
        ...(episode.durationSeconds ? { duration: `PT${Math.round(episode.durationSeconds / 60)}M` } : {}),
        ...(episode.videoUrl?.trim() ? { contentUrl: episode.videoUrl } : { embedUrl: episodeCanonicalUrl }),
      },
    ],
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SiteHeader />
      <GenreTagger genre={series.genre} />
      <EpisodeTracker episodeId={episode.id} />

      <nav aria-label="Breadcrumb" className="px-4 py-2.5 md:px-6">
        <ol className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 text-xs text-[var(--otk-text-dim)]">
          <li>
            <Link href="/" className="hover:text-[var(--otk-text)]">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/episodes" className="hover:text-[var(--otk-text)]">Episodes</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="min-w-0 max-w-[9rem] truncate">
            <Link href={`/episodes/${seriesSlug}`} className="hover:text-[var(--otk-text)]">
              {series.title}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--otk-text)]" aria-current="page">Episode {episode.episodeNumber}</li>
        </ol>
      </nav>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 md:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Player + info */}
          <div className="min-w-0 space-y-5 lg:col-start-1">
            <div className="otk-player-shell">
              <div className="otk-player-box otk-media otk-media-16x9" data-testid="episode-player">
                <VideoPlayer
                  videoUrl={episode.videoUrl}
                  thumbnailUrl={episode.thumbnailUrl}
                  title={episode.title}
                  subtitlesUrl={episode.subtitlesUrl}
                  playId={episode.playId}
                  nextEpisode={navData.next ? {
                    slug: navData.next.slug,
                    seriesSlug,
                    episodeNumber: navData.next.episodeNumber,
                    title: navData.next.title,
                  } : null}
                />
              </div>
              <WatchProgressTracker
                seriesSlug={seriesSlug}
                episodeSlug={episode.slug}
                seriesTitle={series.title}
                epNumber={episode.episodeNumber}
                thumb={episode.thumbnailUrl || series.posterImageUrl || series.coverImageUrl || null}
                durationSeconds={episode.durationSeconds ?? 0}
              />
            </div>

            {/* Compact control row under the player */}
            <div className="otk-control-row" data-testid="episode-controls">
              <div className="min-w-0 flex-1">
                <EpisodeNavigation
                  seriesSlug={seriesSlug}
                  currentEpisode={episode}
                  previousEpisode={navData.previous}
                  nextEpisode={navData.next}
                  allEpisodes={allEpisodes}
                />
              </div>
              <ShareButton url={episodeCanonicalUrl} title={`${episode.title} — ${series.title}`} />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Link href={`/episodes/${seriesSlug}`} className="otk-ep-series-link otk-focus" data-testid="episode-series-link">
                  <SeriesLogo
                    title={series.title}
                    logoPath={series.logoPath}
                    aspect={series.logoAspectRatio}
                    width={series.logoWidth}
                    maxHeight="40px"
                    textClassName="text-[0.8125rem] font-semibold"
                    logoClassName="otk-series-logo"
                  />
                </Link>

                <h1 className="otk-ep-heading" data-testid="episode-heading">
                  Episode {episode.episodeNumber} – {episode.title}
                </h1>

                <div className="otk-stats-line">
                  {series.format ? <span className="otk-chip">{series.format}</span> : null}
                  {episode.subtitlesUrl ? <span className="otk-chip">Subtitled</span> : null}
                  {airDate ? <span>{airDate}</span> : null}
                  {airDate && duration ? <span aria-hidden="true">•</span> : null}
                  {duration ? <span>{duration}</span> : null}
                  <span aria-hidden="true">•</span>
                  <span>{formatViewCount(episode.viewCount ?? 0)} views</span>
                  {episode.totalWatchMinutes && episode.totalWatchMinutes > 0 ? (
                    <>
                      <span aria-hidden="true">•</span>
                      <span>
                        {episode.totalWatchMinutes > 59
                          ? `${Math.floor(episode.totalWatchMinutes / 60)}h ${episode.totalWatchMinutes % 60}m watched`
                          : `${episode.totalWatchMinutes}m watched`}
                      </span>
                    </>
                  ) : null}
                </div>

                <LiveViewerWidget episodeUrl={episodeCanonicalUrl} />
              </div>

              {episode.synopsis ? (
                <ExpandableSynopsis synopsis={episode.synopsis} />
              ) : null}

              {creator ? <CreatorCredit creator={creator} /> : null}
            </div>

            {/* Phones: the aside content becomes ordered sections below the player. */}
            <div className="space-y-6 lg:hidden">
              <UpNextList seriesSlug={seriesSlug} episodes={upNext} currentEpisodeId={episode.id} />
              <AboutSeriesSidebar series={series} episodes={allEpisodes} currentEpisodeId={String(episode.id)} />
              <PollPlacement source="episode" />
            </div>
          </div>

          {/* Desktop sticky aside */}
          <aside className="hidden min-w-0 space-y-6 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-1 lg:block lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto" aria-label="Episode sidebar">
            <UpNextList seriesSlug={seriesSlug} episodes={upNext} currentEpisodeId={episode.id} />
            <AboutSeriesSidebar series={series} episodes={allEpisodes} currentEpisodeId={String(episode.id)} />
            <PollPlacement source="episode" />
          </aside>

          {/* Newsletter + trending, aligned under the player column */}
          <div className="min-w-0 space-y-8 lg:col-start-1">
            <section className="otk-panel otk-panel-pad" aria-labelledby="episode-newsletter-heading">
              <h2 id="episode-newsletter-heading" className="otk-aside-title">
                Weekly anime drops
              </h2>
              <p className="mt-1 mb-3 text-sm text-[var(--otk-text-dim)]">
                New episodes and creator picks, once a week.
              </p>
              <NewsletterSignup />
            </section>

            <div className="otk-section-floor" data-testid="trending-block">
              <Suspense
                fallback={
                  <div className="otk-section-floor">
                    <SeriesGridSkeleton count={8} />
                  </div>
                }
              >
                <TrendingSeriesSection trendingSeries={trendingSeriesData} />
              </Suspense>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
