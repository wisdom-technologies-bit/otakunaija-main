import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getRecentVideos, getVideoBySlug } from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { VideoPlayer } from '@/components/episodes/video-player-client'
import { CreatorCredit } from '@/components/episodes/creator-credit'
import { ExpandableSynopsis } from '@/components/episodes/expandable-synopsis'
import { AboutVideoSidebar } from '@/components/episodes/about-video-sidebar'
import { PollPlacement } from '@/components/poll-placement'
import { SectionTitle } from '@/components/episodes/section-title'
import { formatPublishedDate, formatViewCount } from '@/lib/episode-utils'
import { toISO } from '@/lib/to-iso'

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const result = await getVideoBySlug(slug)
  if (!result) return { title: 'Movie Not Found' }
  return {
    title: result.video.title,
    description: result.video.synopsis || `Watch ${result.video.title} on OtakuNaija.`,
    alternates: { canonical: `/episodes/movies/${result.video.slug}` },
    openGraph: {
      title: result.video.title,
      description: result.video.synopsis || `Watch ${result.video.title} on OtakuNaija.`,
      images: result.video.thumbnailUrl ? [{ url: result.video.thumbnailUrl }] : [],
      type: 'video.other',
    },
  }
}

function labelContentType(contentType: string) {
  return contentType.charAt(0).toUpperCase() + contentType.slice(1)
}

export default async function MoviePage({ params }: Props) {
  const { slug } = await params
  const result = await getVideoBySlug(slug)
  if (!result) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold">Movie Not Found</h1>
            <p className="mb-6 text-foreground/70">The title you are looking for does not exist.</p>
            <Link href="/episodes/movies/browse" className="text-primary hover:underline">Back to Movies</Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }

  const { video, creator, parentSeries } = result
  const recentVideos = await getRecentVideos(24)
  const relatedVideos = recentVideos
    .filter(({ video: candidate }) => candidate.id !== video.id && (candidate.creatorId === video.creatorId || candidate.parentSeriesId === video.parentSeriesId))
    .slice(0, 8)
  const canonical = `https://otakunaija.name.ng/episodes/movies/${video.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://otakunaija.name.ng/' },
          { '@type': 'ListItem', position: 2, name: 'Movies, OVAs & Specials', item: 'https://otakunaija.name.ng/episodes/movies/browse' },
          { '@type': 'ListItem', position: 3, name: video.title, item: canonical },
        ],
      },
      video.contentType === 'movie'
        ? { '@type': 'Movie', name: video.title, description: video.synopsis || undefined, image: video.thumbnailUrl, url: canonical, ...(video.videoUrl?.trim() ? { contentUrl: video.videoUrl } : {}) }
        : { '@type': 'VideoObject', name: video.title, description: video.synopsis || undefined, thumbnailUrl: [video.thumbnailUrl], uploadDate: toISO(video.publishedAt), url: canonical, ...(video.videoUrl?.trim() ? { contentUrl: video.videoUrl } : { embedUrl: canonical }) },
    ],
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <div className="border-b border-border/40 px-4 md:px-6 py-3">
        <div className="mx-auto max-w-7xl text-sm text-foreground/70">
          <Link href="/episodes" className="hover:text-primary transition-colors">Episodes</Link>
          <span className="mx-2">/</span>
          <Link href="/episodes/movies/browse" className="hover:text-primary transition-colors">Movies, OVAs &amp; Specials</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{video.title}</span>
        </div>
      </div>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-6 lg:col-start-1">
            <div className="overflow-hidden rounded-lg bg-black">
              <VideoPlayer videoUrl={video.videoUrl ?? null} thumbnailUrl={video.thumbnailUrl} title={video.title} subtitlesUrl={video.subtitlesUrl ?? null} playId={video.playId ?? null} />
            </div>
            <div className="space-y-5">
              <div className="space-y-3">
                <h1 className="text-xl font-bold text-foreground md:text-2xl">{video.title}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/70">
                  <span>{labelContentType(video.contentType)}</span>
                  {video.genre && <><span>·</span><span>{video.genre}</span></>}
                  {video.durationSeconds && <><span>·</span><span>{Math.floor(video.durationSeconds / 60)} min</span></>}
                  <span>·</span><span>{formatViewCount(video.viewCount ?? 0)} views</span>
                  <span>·</span><span>{formatPublishedDate(video.publishedAt || new Date())}</span>
                </div>
              </div>
              {parentSeries && <Link href={`/episodes/${parentSeries.slug}`} className="font-medium text-primary hover:underline">Part of {parentSeries.title}</Link>}
              {video.synopsis && <ExpandableSynopsis synopsis={video.synopsis} />}
              {creator && <CreatorCredit creator={creator} />}
            </div>
          </div>
          <aside className="no-scrollbar min-w-0 space-y-6 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
            <AboutVideoSidebar video={video} />
            <PollPlacement source="episode" />
          </aside>
          <div className="min-w-0 space-y-8 lg:col-start-1">
            <div className="rounded-lg border border-border/60 bg-card/40 p-5 md:p-6">
              <div className="max-w-2xl">
                <h3 className="mb-2 text-lg font-bold text-foreground md:text-xl">Get weekly anime drops, straight to your inbox.</h3>
                <p className="mb-4 text-sm text-foreground/70">Subscribe to stay updated on new episodes and exclusive creator content.</p>
                <NewsletterSignup />
              </div>
            </div>
            {relatedVideos.length > 0 && (
              <section className="space-y-4">
                <SectionTitle title="More Like This" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {relatedVideos.map(({ video: related }) => (
                    <Link key={related.id} href={`/episodes/movies/${related.slug}`} className="group">
                      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                        <Image src={related.posterImageUrl || related.thumbnailUrl} alt={related.title} fill unoptimized className="object-cover transition-transform group-hover:scale-105" sizes="(max-width: 640px) 50vw, 25vw" />
                        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{labelContentType(related.contentType)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground group-hover:text-primary">{related.title}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
