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
import { CreatorCredit } from '@/components/episodes/creator-credit'
import { EpisodeNavigation } from '@/components/episodes/episode-navigation'
import { EpisodeTracker } from '@/components/episodes/episode-tracker'
import { formatPublishedDate, formatViewCount } from '@/lib/episode-utils'
import { ExpandableSynopsis } from '@/components/episodes/expandable-synopsis'
import { LiveViewerWidget } from '@/components/episodes/live-viewer-widget'
import { AboutSeriesSidebar } from '@/components/episodes/about-series-sidebar'
import { TrendingSeriesSection } from '@/components/episodes/trending-series-section'
import { PollPlacement } from '@/components/poll-placement'

export const revalidate = 3600

interface Props {
  params: Promise<{ 'series-slug': string; 'episode-slug': string }>
}

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

  return {
    title: `${episode.title} — ${series?.title || 'Episode'}`,
    alternates: { canonical: `/episodes/${seriesSlugValue}/${episode.slug}` },
    description:
      episode.synopsis ||
      `Watch ${episode.title} on OtakuNaija. Episode ${episode.episodeNumber} of ${series?.title || 'the series'}.`,
    openGraph: {
      title: `${episode.title} — ${series?.title}`,
      description:
        episode.synopsis ||
        `Watch ${episode.title} on OtakuNaija. Episode ${episode.episodeNumber}.`,
      images: episode.thumbnailUrl ? [{ url: episode.thumbnailUrl }] : [],
      type: 'video.other',
    },
    twitter: {
      card: 'player',
      title: `${episode.title} — ${series?.title}`,
      description: episode.synopsis,
      images: episode.thumbnailUrl ? [episode.thumbnailUrl] : [],
    },
  }
}

export default async function WatchPage({ params }: Props) {
  const { 'series-slug': seriesSlug, 'episode-slug': episodeSlug } = await params
  const episodeData = await getEpisodeBySlugWithContext(episodeSlug)

  if (!episodeData) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Episode Not Found</h1>
            <p className="text-foreground/70 mb-6">The episode you are looking for does not exist.</p>
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
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Series Not Found</h1>
            <p className="text-foreground/70 mb-6">The series for this episode could not be found.</p>
            <Link href="/episodes" className="text-primary hover:underline">
              ← Back to Episodes
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    )
  }

  // Get navigation episodes
  const navData = await getPreviousAndNextEpisode(series.id, episode.episodeNumber)

  // Get all episodes for the series
  const allEpisodes = await getEpisodesBySeries(series.id)

  // Get episode count for sidebar
  const episodeCount = await getLatestEpisodeNumber(series.id)

  // Get trending series for the main content area
  const trendingSeriesData = await getTrendingSeries(12)

  // 1. Generate Schema for TVEpisode, VideoObject, and Breadcrumbs via @graph
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': 'https://otakunaija.name.ng/'
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Episodes',
            'item': 'https://otakunaija.name.ng/episodes'
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': series.title,
            'item': `https://otakunaija.name.ng/episodes/${seriesSlug}`
          },
          {
            '@type': 'ListItem',
            'position': 4,
            'name': `Episode ${episode.episodeNumber}`,
            'item': `https://otakunaija.name.ng/episodes/${seriesSlug}/${episode.slug}`
          }
        ]
      },
      {
        '@type': 'TVEpisode',
        'name': episode.title,
        'episodeNumber': episode.episodeNumber,
        'description': episode.synopsis || `Watch ${episode.title} on OtakuNaija.`,
        'image': episode.thumbnailUrl,
        'partOfSeries': {
          '@type': 'TVSeries',
          'name': series.title,
          'url': `https://otakunaija.name.ng/episodes/${seriesSlug}`
        }
      },
      {
        '@type': 'VideoObject',
        'name': episode.title,
        'description': episode.synopsis || `Watch ${episode.title} on OtakuNaija.`,
        'thumbnailUrl': [episode.thumbnailUrl],
        'uploadDate': episode.publishedAt ? new Date(episode.publishedAt).toISOString() : new Date().toISOString(),
        'contentUrl': episode.videoUrl,
      }
    ]
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 2. Inject the JSON-LD script silently into the HTML */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SiteHeader />
      <EpisodeTracker episodeId={episode.id} />

      {/* Breadcrumb */}
      <div className="border-b border-border/40 px-4 md:px-6 py-3">
        <div className="mx-auto max-w-7xl text-sm text-foreground/70">
          <Link href="/episodes" className="hover:text-primary transition-colors">
            Episodes
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/episodes/${seriesSlug}`} className="hover:text-primary transition-colors">
            {series.title}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Episode {episode.episodeNumber}</span>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 md:px-6 py-8">
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-[1fr_340px]">
          {/* Main Content */}
          <div className="space-y-8 min-w-0">
            {/* Video Player */}
            <div className="overflow-hidden rounded-lg bg-black">
              <VideoPlayer
                videoUrl={episode.videoUrl}
                thumbnailUrl={episode.thumbnailUrl}
                title={episode.title}
                subtitlesUrl={episode.subtitlesUrl}
                playId={episode.playId}
              />
            </div>

            {/* Episode Info */}
            <div className="space-y-6">
              {/* Title and Metadata */}
              <div className="space-y-4">
                <h1 className="text-xl md:text-2xl font-bold text-foreground">{episode.title}</h1>

                <div className="flex flex-wrap items-center gap-4 text-xs text-foreground/70">
                  <Link
                    href={`/episodes/${seriesSlug}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {series.title}
                  </Link>
                  <span>·</span>
                  <span>Episode {episode.episodeNumber}</span>
                  <span>·</span>
                  <span>{formatViewCount(episode.viewCount ?? 0)} views</span>
                  <span>·</span>
                  <span>
                    {episode.totalWatchMinutes && episode.totalWatchMinutes > 0
                      ? episode.totalWatchMinutes > 59
                        ? `${Math.floor(episode.totalWatchMinutes / 60)}h ${episode.totalWatchMinutes % 60}m watched`
                        : `${episode.totalWatchMinutes}m watched`
                      : 'Just started'}
                  </span>
                  <span>·</span>
                  <span>{formatPublishedDate(episode.publishedAt || new Date())}</span>
                </div>
                <LiveViewerWidget
                  episodeUrl={`https://otakunaija.name.ng/episodes/${seriesSlug}/${episode.slug}`}
                />
              </div>

              {/* Navigation Buttons */}
              <EpisodeNavigation
                seriesSlug={seriesSlug}
                currentEpisode={episode}
                previousEpisode={navData.previous}
                nextEpisode={navData.next}
                allEpisodes={allEpisodes}
              />

              {/* Creator Credit */}
              {creator && <CreatorCredit creator={creator} />}

              {/* Synopsis */}
              {episode.synopsis && <ExpandableSynopsis synopsis={episode.synopsis} />}

              {/* Mobile About Series Section */}
              <div className="lg:hidden">
                <AboutSeriesSidebar series={series} episodes={allEpisodes} currentEpisodeId={String(episode.id)} />
              </div>
            </div>

            {/* Newsletter */}
            <div className="rounded-lg border border-border/60 bg-card/40 p-8">
              <div className="max-w-2xl">
                <h3 className="mb-2 text-xl font-bold text-foreground">
                  Get weekly anime drops, straight to your inbox.
                </h3>
                <p className="mb-6 text-foreground/70">
                  Subscribe to stay updated on new episodes and exclusive creator content.
                </p>
                <NewsletterSignup />
              </div>
            </div>

            {/* Trending Series Section */}
            <div className="pt-4">
              <TrendingSeriesSection trendingSeries={trendingSeriesData} />
            </div>
            <PollPlacement source="episode" className="mt-8 max-w-2xl" />
          </div>

          {/* Sidebar - Desktop Only */}
          <div className="hidden lg:block">
            <div className="sticky top-0 space-y-6">
              <AboutSeriesSidebar series={series} episodes={allEpisodes} currentEpisodeId={String(episode.id)} />
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
