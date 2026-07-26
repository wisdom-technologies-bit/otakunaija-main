import { Metadata } from 'next'
import Link from 'next/link'
import {
  getEpisodeBySlugWithContext,
  getPreviousAndNextEpisode,
  getEpisodesBySeries,
} from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { VideoPlayer } from '@/components/episodes/video-player-client'
import { CreatorCredit } from '@/components/episodes/creator-credit'
import { EpisodeNavigation } from '@/components/episodes/episode-navigation'
import { EpisodeTracker } from '@/components/episodes/episode-tracker'
import { MoreEpisodes } from '@/components/episodes/more-episodes'
import { formatPublishedDate, formatViewCount } from '@/lib/episode-utils'
import { ExpandableSynopsis } from '@/components/episodes/expandable-synopsis'
import { LiveViewerWidget } from '@/components/episodes/live-viewer-widget'

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
      image: episode.thumbnailUrl,
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

  // Get all episodes for the "More Episodes" section
  const allEpisodes = await getEpisodesBySeries(series.id)

  // 1. Generate the VideoObject Schema specifically for Google Search
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: episode.title,
    description: episode.synopsis || `Watch ${episode.title} on OtakuNaija.`,
    thumbnailUrl: [episode.thumbnailUrl],
    uploadDate: episode.publishedAt ? new Date(episode.publishedAt).toISOString() : new Date().toISOString(),
    contentUrl: episode.videoUrl,
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

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 md:px-6 py-8">
        {/* Video Player */}
        <div className="mb-8 overflow-hidden rounded-lg bg-black">
          <VideoPlayer
            videoUrl={episode.videoUrl}
            thumbnailUrl={episode.thumbnailUrl}
            title={episode.title}
          />
        </div>

        {/* Episode Info */}
        <div className="space-y-6 mb-8">
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
              <span>{formatViewCount(episode.viewCount)} views</span>
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

          {/* More Episodes */}
          {allEpisodes.length > 1 && (
            <MoreEpisodes
              episodes={allEpisodes}
              currentEpisodeId={episode.id}
              seriesSlug={seriesSlug}
            />
          )}

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
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
