# SECTION 1 — CURRENT STATE: MOVIES/OVAS/SPECIALS

## 1. `app/episodes/movies/[slug]/page.tsx`

The file exists. Current full content:

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { getVideoBySlug } from "@/lib/db/queries"
import { VideoPlayer } from "@/components/episodes/video-player"

export default async function MoviePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getVideoBySlug(slug)
  if (!result) notFound()
  const { video, parentSeries } = result
  const canonical = `/episodes/movies/${video.slug}`
  return <main className="container mx-auto max-w-6xl px-4 py-8"><VideoPlayer videoUrl={video.videoUrl ?? null} thumbnailUrl={video.thumbnailUrl} title={video.title} subtitlesUrl={video.subtitlesUrl ?? null} playId={video.playId ?? null} /><article className="mt-8 max-w-3xl"><p className="text-sm font-semibold uppercase tracking-widest text-primary">{video.contentType} {video.genre ? `· ${video.genre}` : ""}</p><h1 className="mt-2 font-display text-3xl font-bold md:text-5xl">{video.title}</h1><p className="mt-5 leading-7 text-muted-foreground">{video.synopsis || "Watch this title on OtakuNaija."}</p><div className="mt-5 flex flex-wrap gap-3 text-sm text-muted-foreground"><span>{video.durationSeconds ? `${Math.floor(video.durationSeconds / 60)} min` : "Duration unavailable"}</span>{parentSeries && <Link className="text-primary hover:underline" href={`/episodes/${parentSeries.slug}`}>Part of {parentSeries.title}</Link>}</div></article><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(video.contentType === "movie" ? { "@context": "https://schema.org", "@type": "Movie", name: video.title, description: video.synopsis, contentUrl: video.videoUrl || undefined, url: canonical } : { "@context": "https://schema.org", "@type": "VideoObject", name: video.title, description: video.synopsis, ...(video.videoUrl ? { contentUrl: video.videoUrl } : { embedUrl: canonical }), thumbnailUrl: video.thumbnailUrl, url: canonical }) }} /></main>
}
```

This is a standalone video page: it renders the shared `VideoPlayer`, a title/metadata article, synopsis, duration, and optional parent-series link. It has no episode-number navigation, episode sequence, comments, sidebar, breadcrumb UI, ad slot, or related section.

## 2. “Movies, OVAs & Specials” row

The row is present. It is implemented by `components/episodes/movies-row.tsx`:

```tsx
import Link from "next/link"
import Image from "next/image"
import { getRecentVideos } from "@/lib/db/queries"
export async function MoviesRow() { const rows = await getRecentVideos(8); if (!rows.length) return null; return <section className="container mx-auto px-4 py-8"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Movies, OVAs & Specials</h2><Link href="/episodes/movies/browse" className="text-sm text-primary">View all</Link></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">{rows.map(({ video }) => <Link key={video.id} href={`/episodes/movies/${video.slug}`} className="group"><div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted"><Image src={video.posterImageUrl || video.thumbnailUrl} alt={video.title} fill unoptimized className="object-cover transition group-hover:scale-105" /></div><p className="mt-2 line-clamp-2 text-sm font-semibold group-hover:text-primary">{video.title}</p></Link>)}</div></section> }
```

It is wired into `app/episodes/page.tsx` by this import and JSX position:

```tsx
import { MoviesRow } from '@/components/episodes/movies-row'
```

```tsx
<div className="space-y-10 min-w-0 overflow-hidden">
  <UpcomingRow items={serializedUpcomingEpisodes} />

  <NewReleasesRow items={serializedRecentEpisodes} />

  <MoviesRow />

  <RecommendedRow />

  {['Action', 'Adventure', 'Fantasy', 'Romance', 'Comedy'].map((genreName) => (
    <Suspense key={genreName} fallback={<GenreRowSkeleton />}>
      <GenreRow genre={genreName} />
    </Suspense>
  ))}

  <AdSlot slot="footer" label="footer" />
</div>
```

Therefore it was added and is rendered after New Releases and before Recommended For You.

# SECTION 2 — THE EPISODE WATCH PAGE'S FULL STRUCTURE AND UI

Current full content of `app/episodes/[series-slug]/[episode-slug]/page.tsx`:

```tsx
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
import { formatPublishedDate, formatViewCount } from '@/lib/episode-utils'
import { ExpandableSynopsis } from '@/components/episodes/expandable-synopsis'
import { LiveViewerWidget } from '@/components/episodes/live-viewer-widget'
import { AboutSeriesSidebar } from '@/components/episodes/about-series-sidebar'
import { TrendingSeriesSection } from '@/components/episodes/trending-series-section'
import { PollPlacement } from '@/components/poll-placement'
import { toISO } from '@/lib/to-iso'
import { GenreTagger } from '@/components/push/genre-tagger'

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

  const episodeCanonicalUrl = `https://otakunaija.name.ng/episodes/${seriesSlug}/${episode.slug}`

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
        'uploadDate': toISO(episode.publishedAt),
        ...(episode.videoUrl?.trim()
          ? { contentUrl: episode.videoUrl }
          : { embedUrl: episodeCanonicalUrl }),
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
      <GenreTagger genre={series.genre} />
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

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* Player + info */}
          <div className="min-w-0 space-y-6 lg:col-start-1">
            <div className="overflow-hidden rounded-lg bg-black">
              <VideoPlayer
                videoUrl={episode.videoUrl}
                thumbnailUrl={episode.thumbnailUrl}
                title={episode.title}
                subtitlesUrl={episode.subtitlesUrl}
                playId={episode.playId}
              />
              <WatchProgressTracker
                seriesSlug={seriesSlug}
                episodeSlug={episode.slug}
                seriesTitle={series.title}
                epNumber={episode.episodeNumber}
                thumb={episode.thumbnailUrl || series.posterImageUrl || series.coverImageUrl || null}
                durationSeconds={episode.durationSeconds ?? 0}
              />
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <h1 className="text-xl font-bold text-foreground md:text-2xl">{episode.title}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/70">
                  <Link href={`/episodes/${seriesSlug}`} className="font-medium text-primary hover:underline">{series.title}</Link>
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
                <LiveViewerWidget episodeUrl={`https://otakunaija.name.ng/episodes/${seriesSlug}/${episode.slug}`} />
              </div>

              <EpisodeNavigation
                seriesSlug={seriesSlug}
                currentEpisode={episode}
                previousEpisode={navData.previous}
                nextEpisode={navData.next}
                allEpisodes={allEpisodes}
              />
              {creator && <CreatorCredit creator={creator} />}
              {episode.synopsis && <ExpandableSynopsis synopsis={episode.synopsis} />}
            </div>
          </div>

          {/* Sidebar: rendered once */}
          <aside className="no-scrollbar min-w-0 space-y-6 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
            <AboutSeriesSidebar series={series} episodes={allEpisodes} currentEpisodeId={String(episode.id)} />
            <PollPlacement source="episode" />
          </aside>

          {/* Newsletter + trending */}
          <div className="min-w-0 space-y-8 lg:col-start-1">
            <div className="rounded-lg border border-border/60 bg-card/40 p-5 md:p-6">
              <div className="max-w-2xl">
                <h3 className="mb-2 text-lg font-bold text-foreground md:text-xl">Get weekly anime drops, straight to your inbox.</h3>
                <p className="mb-4 text-sm text-foreground/70">Subscribe to stay updated on new episodes and exclusive creator content.</p>
                <NewsletterSignup />
              </div>
            </div>
            <TrendingSeriesSection trendingSeries={trendingSeriesData} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
```

## Major watch-page sections

### Player area

Rendered by `components/episodes/video-player-client.tsx`, which dynamically loads `components/episodes/video-player.tsx` with `{ ssr: false }`. The page wrapper is:

```tsx
<div className="overflow-hidden rounded-lg bg-black">
  <VideoPlayer
    videoUrl={episode.videoUrl}
    thumbnailUrl={episode.thumbnailUrl}
    title={episode.title}
    subtitlesUrl={episode.subtitlesUrl}
    playId={episode.playId}
  />
  <WatchProgressTracker
    seriesSlug={seriesSlug}
    episodeSlug={episode.slug}
    seriesTitle={series.title}
    epNumber={episode.episodeNumber}
    thumb={episode.thumbnailUrl || series.posterImageUrl || series.coverImageUrl || null}
    durationSeconds={episode.durationSeconds ?? 0}
  />
</div>
```

The actual player classes in `components/episodes/video-player.tsx` are:

```tsx
<div className="flex aspect-video w-full items-center justify-center bg-black" role="status">
```

```tsx
<div className="flex aspect-video w-full items-center justify-center bg-black px-6 text-center text-sm text-white">
```

```tsx
<div className="w-full bg-black">
  <video className="h-auto w-full plyr-react" ...>
```

```tsx
<div
  className="relative w-full cursor-pointer bg-black"
  style={{ aspectRatio: '16 / 9' }}
  ...
>
```

```tsx
<Image
  ...
  className="object-cover"
/>

<div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-all hover:bg-black/40">
  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/70 shadow-lg transition-transform hover:scale-110">
    <Play className="h-8 w-8 fill-white text-white ml-1" />
  </div>
</div>
```

The player itself is episode-agnostic and works unchanged for a standalone video. `WatchProgressTracker` is episode/series-specific because it receives `seriesSlug`, `episodeSlug`, `seriesTitle`, and `epNumber`.

### Breadcrumbs

Rendered directly in the watch page:

```tsx
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
```

This is episode/series-specific because it includes the series route and episode number. A standalone video would need different breadcrumb labels/routes.

### Page layout

The relevant layout classes are:

```tsx
<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
  <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
```

The main column wrapper is:

```tsx
<div className="min-w-0 space-y-6 lg:col-start-1">
```

The page has no separate comments component or comments section.

### Title and metadata block

Rendered directly in the page. Exact classes:

```tsx
<div className="space-y-5">
  <div className="space-y-3">
    <h1 className="text-xl font-bold text-foreground md:text-2xl">{episode.title}</h1>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/70">
      <Link href={`/episodes/${seriesSlug}`} className="font-medium text-primary hover:underline">{series.title}</Link>
      <span>·</span>
      <span>Episode {episode.episodeNumber}</span>
      <span>·</span>
      <span>{formatViewCount(episode.viewCount ?? 0)} views</span>
      <span>·</span>
      <span>...</span>
    </div>
    <LiveViewerWidget episodeUrl={`https://otakunaija.name.ng/episodes/${seriesSlug}/${episode.slug}`} />
  </div>
```

This is episode-specific: it displays episode number, episode view count, watch minutes, published date, and a URL containing both series and episode slugs.

### Episode navigation panel

Rendered by `components/episodes/episode-navigation.tsx` with the exact call:

```tsx
<EpisodeNavigation
  seriesSlug={seriesSlug}
  currentEpisode={episode}
  previousEpisode={navData.previous}
  nextEpisode={navData.next}
  allEpisodes={allEpisodes}
/>
```

The component's compact layout classes include:

```tsx
<div className="flex flex-wrap items-center gap-2">
```

```tsx
<button className="flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 font-medium text-primary transition-all hover:bg-primary/20 active:scale-95">
```

```tsx
<button className="flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-muted px-3 py-2 font-medium text-muted-foreground cursor-not-allowed opacity-50">
```

```tsx
className={`flex h-9 w-9 items-center justify-center rounded-lg border font-bold ${fontSizeClass} transition-all ${
  ep.id === currentEpisode.id
    ? 'border-primary bg-primary/20 text-primary'
    : 'border-border/60 bg-card hover:border-primary/50 hover:bg-card/80 text-foreground/80 hover:text-foreground'
}`}
```

Expanded layout classes include:

```tsx
<div className="space-y-4">
  <div className="grid grid-cols-7 gap-2">
```

```tsx
className={`aspect-square flex items-center justify-center rounded-lg border-2 font-bold ${fontSizeClass} transition-all ${ep.id === currentEpisode.id
  ? 'border-primary bg-primary/20 text-primary'
  : 'border-border/60 bg-card hover:border-primary/50 hover:bg-card/80 text-foreground/80 hover:text-foreground'
}`}
```

This section is entirely episode-sequence-specific. It requires `episodeNumber`, `previousEpisode`, `nextEpisode`, and `allEpisodes`; it would not work unchanged for a standalone video.

### Creator credit and synopsis

The page renders these components conditionally:

```tsx
{creator && <CreatorCredit creator={creator} />}
{episode.synopsis && <ExpandableSynopsis synopsis={episode.synopsis} />}
```

The synopsis data is episode-specific. The expandable presentation could be reused for standalone synopsis text, but the current page passes the episode synopsis and is conditionally tied to `episode.synopsis`.

### Series info sidebar

The sidebar wrapper is rendered directly by the page:

```tsx
<aside className="no-scrollbar min-w-0 space-y-6 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
  <AboutSeriesSidebar series={series} episodes={allEpisodes} currentEpisodeId={String(episode.id)} />
  <PollPlacement source="episode" />
</aside>
```

`components/episodes/about-series-sidebar.tsx` uses these layout classes:

```tsx
<div className="space-y-6">
  <div className="space-y-3">
    <h2 className="text-lg font-bold text-foreground">About {series.title}</h2>
    <div className="flex gap-4">
      <div className="relative aspect-[2/3] w-28 flex-shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted sm:w-32">
```

```tsx
<div className="min-w-0 flex-1 space-y-2">
  <p className="line-clamp-6 text-sm leading-relaxed text-foreground/80">
```

```tsx
<div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
  <div className="flex items-center justify-between">
```

```tsx
<div className="space-y-2">
```

```tsx
className={`group flex items-center gap-2 rounded p-2 transition-all ${
  isCurrentEpisode
    ? 'bg-primary/20 border border-primary/40'
    : 'hover:bg-card/60 border border-transparent'
}`}
```

```tsx
<div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-muted">
```

```tsx
<div className="flex-1 min-w-0">
```

```tsx
<div className="flex items-center gap-1.5">
```

```tsx
<div className="text-[11px] text-foreground/60 flex items-center gap-2">
```

This sidebar is series/episode-specific: it displays series synopsis and poster, the series episode list, current-episode highlighting, episode numbers, release dates, and episode view counts. The ad slot and “Add Placement” card are generic sidebar placements but are currently inside this series sidebar component.

### Newsletter, related/recommended, and ad areas

The lower main-column area is:

```tsx
<div className="min-w-0 space-y-8 lg:col-start-1">
  <div className="rounded-lg border border-border/60 bg-card/40 p-5 md:p-6">
    <div className="max-w-2xl">
      <h3 className="mb-2 text-lg font-bold text-foreground md:text-xl">Get weekly anime drops, straight to your inbox.</h3>
      <p className="mb-4 text-sm text-foreground/70">Subscribe to stay updated on new episodes and exclusive creator content.</p>
      <NewsletterSignup />
    </div>
  </div>
  <TrendingSeriesSection trendingSeries={trendingSeriesData} />
</div>
```

`components/episodes/trending-series-section.tsx` uses:

```tsx
<div className="space-y-4">
  <h3 className="text-lg font-bold text-foreground">Trending Series</h3>
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
```

```tsx
<div className="text-center mt-6">
  <Link
    href="/episodes"
    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
  >
```

This recommended/trending section is not episode-sequence-dependent in its visual structure, but the current data is series-specific and the links target series pages. It could work for standalone videos after changing its data and hrefs.

The watch page has two explicit ad-related placements: `AboutSeriesSidebar` renders `<AdSlot slot="sidebar" label="sidebar" />`, and `PollPlacement source="episode"` is rendered after the sidebar. There is no separate inline player ad component in this page.

# SECTION 3 — THE `/episodes` HOMEPAGE'S VISUAL SYSTEM

## Full `app/episodes/page.tsx`

```tsx
import type { Metadata } from 'next'
import {
  getRecentEpisodesAcrossAllSeries,
  getUpcomingEpisodes,
  getTrendingSeries,
} from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { AdSlot } from '@/components/ad-slot'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { GenreRow } from '@/components/episodes/genre-row'
import { toISO } from '@/lib/to-iso'
import { SeriesHeroCarousel } from '@/components/episodes/series-hero-carousel'
import { ResumeWatchingRow } from '@/components/episodes/resume-watching-row'
import { NewReleasesRow } from '@/components/episodes/new-releases-row'
import RecommendedRow from '@/components/episodes/recommended-row'
import { UpcomingRow } from '@/components/episodes/upcoming-row'
import { EpisodesSidebar } from '@/components/episodes/episodes-sidebar'
import { PollPlacement } from '@/components/poll-placement'
import { MoviesRow } from '@/components/episodes/movies-row'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Episodes',
  description: 'Watch original anime series. Discover exclusive anime content.',
  alternates: { canonical: '/episodes' },
  openGraph: {
    title: 'Episodes',
    description: 'Watch original anime series and episodes.',
  },
}

interface EpisodesPageProps {
  searchParams: Promise<{ genre?: string; status?: string }>
}

function GenreRowSkeleton() {
  return <div className="flex gap-4 overflow-hidden"><div className="h-52 w-[120px] shrink-0 rounded-lg bg-muted" /><div className="h-52 w-[120px] shrink-0 rounded-lg bg-muted" /><div className="h-52 w-[120px] shrink-0 rounded-lg bg-muted" /><div className="h-52 w-[120px] shrink-0 rounded-lg bg-muted" /></div>
}

export default async function EpisodesPage({ searchParams }: EpisodesPageProps) {
  const { genre, status } = await searchParams
  if (genre) redirect(`/episodes/browse?genre=${encodeURIComponent(genre)}`)
  if (status) redirect(`/episodes/browse?status=${encodeURIComponent(status)}`)

  let error = null
  let recentEpisodes: any[] = []
  let upcomingEpisodes: any[] = []
  let trendingSeries: any[] = []
  try {
    ;[recentEpisodes, upcomingEpisodes, trendingSeries] = await Promise.all([
      getRecentEpisodesAcrossAllSeries(10),
      getUpcomingEpisodes(12),
      getTrendingSeries(5),
    ])
  } catch (err) {
    console.error('Error fetching episodes data:', err)
    error = 'Failed to load episodes. Please try again later.'
  }

  const serializeEpisodes = (items: any[]) => items.map(({ episode, series, creator }) => ({
    episode: { ...episode, publishedAt: toISO(episode.publishedAt) },
    series,
    creator,
  }))
  const serializedRecentEpisodes = serializeEpisodes(recentEpisodes)
  const serializedUpcomingEpisodes = serializeEpisodes(upcomingEpisodes)
  const heroSeries = trendingSeries.slice(0, 4).map((item) => item.series)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Home',
                    item: 'https://otakunaija.name.ng/',
                  },
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: 'Episodes',
                    item: 'https://otakunaija.name.ng/episodes',
                  },
                ],
              },
              {
                '@type': 'CollectionPage',
                name: 'Anime Episodes & Series — OtakuNaija',
                description:
                  'Browse and stream the latest anime episodes, series guides, and recaps on OtakuNaija.',
                url: 'https://otakunaija.name.ng/episodes',
              },
            ],
          }),
        }}
      />

      <SiteHeader />

      {/* Page Header */}
      <section className="border-b border-border/40 py-4 md:py-8">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="space-y-4">
            <SeriesHeroCarousel seriesList={heroSeries} />
            <ResumeWatchingRow />
          </div>
        </div>
      </section>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 md:px-6 py-8">
        {error && (
          <div className="mb-8 rounded-lg border border-red-400/30 bg-red-900/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Two‑column layout with safety constraints */}
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10 min-w-0 overflow-hidden">
            <UpcomingRow items={serializedUpcomingEpisodes} />

            <NewReleasesRow items={serializedRecentEpisodes} />

            <MoviesRow />

            <RecommendedRow />

            {['Action', 'Adventure', 'Fantasy', 'Romance', 'Comedy'].map((genreName) => (
              <Suspense key={genreName} fallback={<GenreRowSkeleton />}>
                <GenreRow genre={genreName} />
              </Suspense>
            ))}

            <AdSlot slot="footer" label="footer" />
          </div>

          <EpisodesSidebar trendingSeries={trendingSeries} />
        </div>


        <PollPlacement source="episodes" className="mx-auto mt-14 max-w-2xl" />
      </main>

      <SiteFooter />
    </div>
  )
}
```

## `SeriesHeroCarousel`

Full component content is in `components/episodes/series-hero-carousel.tsx` and uses the following visual system:

```tsx
<div className="w-full max-w-full">
  <div className="relative isolate h-60 overflow-hidden rounded-2xl border border-white/10 bg-black sm:h-72 md:h-[24rem]">
```

```tsx
<div className="absolute inset-0 bg-gradient-to-r from-background via-background/75 to-transparent md:via-background/60" />
<div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
<div className="absolute inset-0 ..." />
```

```tsx
<div className="absolute inset-0 flex flex-col justify-end gap-2 p-4 pl-5 ... sm:p-6 sm:pl-8 md:max-w-[62%] md:gap-3 md:p-10">
```

```tsx
<h2 className="font-display line-clamp-2 text-2xl font-extrabold uppercase italic leading-[1.05] tracking-tight text-foreground ... sm:text-4xl md:text-5xl">
```

```tsx
<div className="flex flex-wrap gap-1.5">
<span className="rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
```

```tsx
<p className="line-clamp-2 max-w-xl text-xs text-foreground/80 sm:text-sm md:line-clamp-3 md:text-base">
```

```tsx
<Link className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 sm:text-sm md:px-5 md:py-2.5">
```

```tsx
<div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
<button className={`relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-md border transition-all ${...}`}>
```

It has a 240px mobile hero, 288px at `sm`, and 24rem at `md`; desktop poster is `w-36`/`lg:w-44`, rotated, rounded, bordered, and shadowed. Transitions are `animate-in fade-in`, `slide-in-from-bottom-2`, `slide-in-from-right-4`, `transition`, and thumbnail `transition-all` with active primary ring.

## `UpcomingRow`

Full component content:

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { Countdown } from '@/components/episodes/countdown'
import { formatReleaseDate } from '@/lib/format-date'
import { SectionTitle } from '@/components/episodes/section-title'

type UpcomingItem = { episode: { id: number; slug: string; title: string; episodeNumber: number; thumbnailUrl: string | null; publishedAt: string | null }; series: { slug: string; title: string; posterImageUrl: string | null; coverImageUrl: string | null } | null }

export function UpcomingRow({ items }: { items: UpcomingItem[] }) {
  if (!items.length) return null
  return <section>
    <SectionTitle title="Upcoming" href="/episodes/new-releases" />
    <div className="flex w-full gap-4 overflow-x-auto overflow-y-hidden pb-2 touch-pan-x no-scrollbar"><div className="flex gap-4 min-w-max">
      {items.map(({ episode, series }) => series ? <Link key={episode.id} href={`/episodes/${series.slug}/${episode.slug}`} className="group w-40 flex-shrink-0">
        <div className="relative aspect-video w-40 overflow-hidden rounded-lg bg-muted">
          {(episode.thumbnailUrl || series.posterImageUrl || series.coverImageUrl) ? <Image src={episode.thumbnailUrl || series.posterImageUrl || series.coverImageUrl || ''} alt={episode.title} fill className="object-cover transition-transform group-hover:scale-105" sizes="160px" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"><span className="text-xs text-muted-foreground">No image</span></div>}
          <span className="absolute left-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black">Soon</span>
          <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">Ep {episode.episodeNumber}</span>
        </div>
        <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">{series.title}</p>
        <p className="text-xs font-medium text-foreground"><Countdown releaseAt={episode.publishedAt || ''} /></p>
      </Link> : null)}
    </div></div>
  </section>
}
```

Cards are fixed `w-40`/160px and `aspect-video`, with `gap-4` between row items, rounded-lg image containers, `transition-transform group-hover:scale-105`, and title text `text-sm font-medium`.

## `NewReleasesRow`

Full component content:

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { formatRelativeTime } from '@/lib/posts'
import { SectionTitle } from '@/components/episodes/section-title'
type ReleaseEpisode = { id: number; slug: string; title: string; episodeNumber: number; thumbnailUrl: string | null; publishedAt: string | null }
type ReleaseSeries = { slug: string; title: string; posterImageUrl: string | null; coverImageUrl: string | null }

interface NewReleasesRowProps {
  items: { episode: ReleaseEpisode; series: ReleaseSeries | null }[]
}

export function NewReleasesRow({ items }: NewReleasesRowProps) {
  return (
    <section>
      <SectionTitle title="New Releases" href="/episodes/new-releases" />
      <div className="flex w-full gap-4 overflow-x-auto overflow-y-hidden pb-2 touch-pan-x no-scrollbar">
        <div className="flex gap-4 min-w-max">
          {items.map(({ episode, series: ser }) =>
            ser ? (
              <Link
                key={episode.id}
                href={`/episodes/${ser.slug}/${episode.slug}`}
                className="group w-40 flex-shrink-0"
              >
                <div className="relative aspect-video w-40 overflow-hidden rounded-lg bg-muted">
                  {episode.thumbnailUrl ? (
                    <Image
                      src={episode.thumbnailUrl}
                      alt={episode.title}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="160px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <span className="text-xs text-muted-foreground">No image</span>
                    </div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    New
                  </span>
                  <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Ep {episode.episodeNumber}
                  </span>
                </div>
                <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">
                  {ser.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {episode.publishedAt ? formatRelativeTime(episode.publishedAt.toString()) : ''}
                </p>
              </Link>
            ) : null
          )}
        </div>
      </div>
    </section>
  )
}
```

The dimensions and treatment match Upcoming: `w-40`, `aspect-video`, `gap-4`, `rounded-lg`, `bg-muted`, image `object-cover transition-transform group-hover:scale-105`, title `mt-2 line-clamp-1 text-sm font-medium`, and metadata `text-xs text-muted-foreground`.

## `RecommendedRow`

Full component content:

```tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getHistory, HISTORY_CHANGED_EVENT } from '@/lib/watch-history'
import SectionTitle from '@/components/episodes/section-title'

type Recommendation = { slug: string; title: string; posterUrl: string | null; genre: string; latestEpisodeNumber: number | null }

export default function RecommendedRow() {
  const [items, setItems] = useState<Recommendation[] | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined
    const load = () => {
      const slugs = [...new Set(getHistory().map((entry) => entry.seriesSlug))]
      if (!slugs.length) { setItems([]); return }
      fetch(`/api/episodes/recommendations?slugs=${encodeURIComponent(slugs.join(','))}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('Recommendation request failed')))
        .then((data: { series?: Recommendation[] }) => setItems(data.series ?? []))
        .catch((error: unknown) => { if ((error as { name?: string }).name !== 'AbortError') setItems([]) })
    }
    load()
    const onChange = () => { window.clearTimeout(timer); timer = window.setTimeout(load, 500) }
    window.addEventListener(HISTORY_CHANGED_EVENT, onChange)
    return () => { window.clearTimeout(timer); controller.abort(); window.removeEventListener(HISTORY_CHANGED_EVENT, onChange) }
  }, [])
  if (!items?.length) return null
  return <section><SectionTitle title="Recommended For You" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{items.map((item) => <Link key={item.slug} href={`/episodes/${item.slug}`} className="min-w-0"><div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted"><Image src={item.posterUrl ?? '/placeholder.svg'} alt={item.title} fill sizes="(min-width: 640px) 25vw, 50vw" className="object-cover" /><span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">{item.genre}</span>{item.latestEpisodeNumber != null && <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">Ep {item.latestEpisodeNumber}</span>}</div><p className="mt-2 line-clamp-2 text-xs font-medium">{item.title}</p></Link>)}</div></section>
}
```

Cards are responsive poster cards: two columns by default and four at `sm`, with `gap-3`, `aspect-[2/3]`, `rounded-lg`, `bg-muted`, and `text-xs font-medium` labels. Unlike the episode rows, the image has no hover transform class.

## `GenreRow`

Full component content:

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { getTopSeriesByGenre } from '@/lib/db/queries'
import SectionTitle from '@/components/episodes/section-title'

export async function GenreRow({ genre }: { genre: string }) {
  let items: Awaited<ReturnType<typeof getTopSeriesByGenre>> = []
  try {
    items = await getTopSeriesByGenre(genre)
  } catch (error) {
    console.error(`[episodes] genre-row ${genre} failed`, error)
    return null
  }
  if (items.length < 3) return null
  // ...the rest of your return (...) stays exactly the same

  return (
    <section>
    <SectionTitle title={genre} href={`/episodes/browse?genre=${encodeURIComponent(genre)}`} />
      <div className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto no-scrollbar overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ series, latestEpisodeNumber }, index) => (
          <Link key={series.id} href={`/episodes/${series.slug}`} className="group w-[120px] shrink-0 snap-start">
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
              {series.posterImageUrl || series.coverImageUrl ? (
                <Image src={series.posterImageUrl || series.coverImageUrl!} alt={series.title} fill className="object-cover transition-transform group-hover:scale-105" sizes="120px" />
              ) : <div className="h-full bg-gradient-to-br from-primary/20 to-primary/5" />}
              <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{index + 1}</span>
              {latestEpisodeNumber !== null && <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">Ep {latestEpisodeNumber}</span>}
            </div>
            <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground group-hover:text-primary">{series.title}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
```

Cards are fixed `w-[120px]`, poster ratio `aspect-[2/3]`, `gap-4`, snap scrolling, rounded-lg image frame, and hover image scaling via `transition-transform group-hover:scale-105`.

## `EpisodesSidebar`

Full component content:

```tsx
import Link from 'next/link'
import { Flame } from 'lucide-react'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { AdSlot } from '@/components/ad-slot'
import type { series as Series, creators as Creator } from '@/lib/db/schema'

interface EpisodesSidebarProps {
  trendingSeries: { series: typeof Series.$inferSelect; creator: typeof Creator.$inferSelect | null; totalViews: number }[]
}

export function EpisodesSidebar({ trendingSeries }: EpisodesSidebarProps) {
  return (
    <aside className="space-y-8 lg:sticky lg:top-20">
      <section id="newsletter" className="scroll-mt-24 rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 text-base font-bold text-foreground">
          Get weekly anime drops, straight to your inbox.
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          New episodes, reviews, and recommendations every Sunday. No spam.
        </p>
        <NewsletterSignup />
      </section>

      <AdSlot slot="sidebar" />

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Flame className="h-4 w-4 text-primary" /> Trending Now
        </h3>
        <div className="mt-3 divide-y divide-border">
          {trendingSeries.map(({ series: s }, idx) => (
            <div key={s.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="w-6 text-2xl font-bold leading-none text-primary/60">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="flex-1">
                <Link
                  href={`/episodes/${s.slug}`}
                  className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary"
                >
                  {s.title}
                </Link>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.genre || 'Anime'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}
```

The homepage sidebar is `space-y-8`, sticky at `lg:top-20`; its cards use `rounded-xl border border-border bg-card p-5`; trending entries use `gap-3 py-3`, large rank text `text-2xl`, title `text-sm`, and genre `text-[11px] uppercase tracking-wider`.

## Shared section title

`components/episodes/section-title.tsx` is used by the rows:

```tsx
'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export function SectionTitle({ title, href, action }: { title: string; href?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center text-lg font-semibold text-foreground sm:text-xl">
        <span aria-hidden="true" className="mr-2 h-5 w-1 rounded-full bg-primary" />
        {title}
      </h2>
      {action ?? (href ? <Link href={href} className="text-sm font-medium text-primary hover:underline">View All</Link> : null)}
    </div>
  )
}

export default SectionTitle
```

## Movies browse grid comparison

`app/episodes/movies/browse/page.tsx` currently uses plain `Image`/`Link` markup rather than the shared row components:

```tsx
<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{items.map(({ video }) => <Link key={video.id} href={`/episodes/movies/${video.slug}`} className="group"><div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted"><Image src={video.posterImageUrl || video.thumbnailUrl} alt={video.title} fill unoptimized className="object-cover transition duration-300 group-hover:scale-105" sizes="(max-width: 640px) 50vw, 16vw" /><span className="absolute left-2 top-2 rounded bg-primary px-2 py-1 text-[10px] font-bold uppercase text-primary-foreground">{video.contentType}</span></div><h2 className="mt-2 line-clamp-2 text-sm font-semibold group-hover:text-primary">{video.title}</h2></Link>)}</div>
```

It does use some of the same low-level classes (`aspect-[2/3]`, `overflow-hidden`, `rounded-lg`, `bg-muted`, `group`, hover scale, `line-clamp-2`, `group-hover:text-primary`), but it does not use `SectionTitle`, the shared `w-[120px]`/`w-40` row sizing, row scrolling, or the row components' exact typography. The browse page uses a six-column responsive grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`) and adds a content-type badge.

# SECTION 4 — SHARED DESIGN TOKENS

The central token file is `app/globals.css`. `styles/globals.css` was also inspected and does not provide the active token definitions; the active file contains the following complete token/theme section:

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@plugin '@tailwindcss/typography';

@custom-variant dark (&:is(.dark *));

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}

:root,
.dark {
  /* Dark anime theme */
  --background: oklch(0.13 0.01 280);
  --foreground: oklch(0.97 0 0);
  --card: oklch(0.18 0.01 280);
  --card-foreground: oklch(0.97 0 0);
  --popover: oklch(0.18 0.01 280);
  --popover-foreground: oklch(0.97 0 0);
  --primary: oklch(0.68 0.22 25);
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.22 0.01 280);
  --secondary-foreground: oklch(0.97 0 0);
  --muted: oklch(0.22 0.01 280);
  --muted-foreground: oklch(0.68 0.01 280);
  --accent: oklch(0.68 0.22 25);
  --accent-foreground: oklch(0.99 0 0);
  --destructive: oklch(0.6 0.24 27);
  --destructive-foreground: oklch(0.99 0 0);
  --border: oklch(0.25 0.01 280);
  --input: oklch(0.22 0.01 280);
  --ring: oklch(0.68 0.22 25);
  --chart-1: oklch(0.68 0.22 25);
  --chart-2: oklch(0.7 0.18 50);
  --chart-3: oklch(0.6 0.15 280);
  --chart-4: oklch(0.65 0.18 200);
  --chart-5: oklch(0.75 0.15 80);
  --sidebar: oklch(0.15 0.01 280);
  --sidebar-foreground: oklch(0.97 0 0);
  --sidebar-primary: oklch(0.68 0.22 25);
  --sidebar-primary-foreground: oklch(0.99 0 0);
  --sidebar-accent: oklch(0.22 0.01 280);
  --sidebar-accent-foreground: oklch(0.97 0 0);
  --sidebar-border: oklch(0.25 0.01 280);
  --sidebar-ring: oklch(0.68 0.22 25);
  --radius: 0.5rem;
  color-scheme: dark;
}

@theme inline {
  --font-sans: var(--font-inter), 'Inter Fallback', system-ui, sans-serif;
  --font-display: var(--font-outfit), 'Outfit Fallback', system-ui, sans-serif;
  --font-mono: 'Geist Mono', 'Geist Mono Fallback', monospace;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}
```

There is a central color token set and radius scale. Tailwind supplies spacing utilities rather than a project-defined spacing scale; the inspected CSS does not define custom `--spacing-*` variables. Font classes are centralized through `@theme inline` (`--font-sans`, `--font-display`, and `--font-mono`) and the custom utility:

```css
.font-display {
  font-family: var(--font-display);
  letter-spacing: -0.02em;
}
```

The remaining design system is expressed directly through Tailwind utility classes in the components: `gap-2`, `gap-3`, `gap-4`, `space-y-*`, `rounded-lg`, `rounded-xl`, `text-*`, `bg-*`, `border-*`, and the responsive grid/flex classes shown above. No separate design-tokens file defining a custom spacing scale was found.

The stylesheet also contains the player-specific tokens and hero animation:

```css
.plyr {
  --plyr-color-main: var(--primary);
  --plyr-control-radius: 0.25rem;
  --plyr-range-track-height: 0.25rem;
  background-color: #1a0d1a;
}

@keyframes hero-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.hero-progress { transform-origin: left; animation: hero-progress 6s linear forwards; }
```

No code was changed except this requested report file.

# VALIDATION

The report was produced from the current files listed in the report. The report file is plain Markdown/text and contains actual source snippets and exact class strings rather than paraphrased descriptions.
```
