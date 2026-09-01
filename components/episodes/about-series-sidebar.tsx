'use client'

import Link from 'next/link'
import Image from 'next/image'
import { type Series, type Episode } from '@/lib/db/schema'
import { AdSlot } from '@/components/ad-slot'
import { formatViewCount } from '@/lib/episode-utils'
import { PlayCircle } from 'lucide-react'

interface AboutSeriesSidebarProps {
  series: Series
  episodes: Episode[]
  currentEpisodeId?: string
}

export function AboutSeriesSidebar({ series, episodes, currentEpisodeId }: AboutSeriesSidebarProps) {
  // Format episode count: 1-99 = "##", 100+ = "100+", 200+ = "200+", etc
  const episodeCount = episodes.length
  const episodeCountDisplay = episodeCount >= 100 
    ? `${Math.floor(episodeCount / 100) * 100}+`
    : episodeCount.toString()

  // Get upcoming episodes (sorted newest first) - show up to 5
  const upcomingEpisodes = [...episodes]
    .sort((a, b) => b.episodeNumber - a.episodeNumber)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* About Series Card */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">About {series.title}</h2>
        
        {/* Poster Image - Smaller */}
        <div className="relative w-24 overflow-hidden rounded border border-border/60 bg-muted" style={{ aspectRatio: '9/16' }}>
          {series.posterImageUrl ? (
            <Image
              src={series.posterImageUrl}
              alt={series.title}
              fill
              className="object-cover"
              sizes="96px"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <span className="text-xs text-muted-foreground">No</span>
            </div>
          )}
        </div>

        {/* Synopsis */}
        <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4">
          {series.synopsis || 'No synopsis available'}
        </p>

        {/* View Series Details Button */}
        <Link 
          href={`/episodes/${series.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View Series Details
          <span>›</span>
        </Link>
      </div>

      {/* Episodes List Card */}
      <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Episodes ({episodeCountDisplay})</h3>
          <Link 
            href={`/episodes/${series.slug}#episodes`}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View all
          </Link>
        </div>

        {/* Episodes List */}
        <div className="space-y-2">
          {upcomingEpisodes.length > 0 ? (
            upcomingEpisodes.map((episode) => {
              const isCurrentEpisode = String(episode.id) === currentEpisodeId
              const publishedDate = new Date(episode.publishedAt || new Date()).toLocaleDateString(
                'en-US',
                { year: 'numeric', month: 'short', day: 'numeric' }
              )

              return (
                <Link
                  key={episode.id}
                  href={`/episodes/${series.slug}/${episode.slug}`}
                  className={`group flex items-center gap-2 rounded p-2 transition-all ${
                    isCurrentEpisode 
                      ? 'bg-primary/20 border border-primary/40' 
                      : 'hover:bg-card/60 border border-transparent'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-muted">
                    {episode.thumbnailUrl ? (
                      <Image
                        src={episode.thumbnailUrl}
                        alt={`Episode ${episode.episodeNumber}`}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-[9px]">
                        Ep
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="flex-shrink-0 rounded bg-red-600/90 px-1 py-0.5 text-[10px] font-bold text-white">
                        EP {episode.episodeNumber.toString().padStart(4, '0')}
                      </span>
                      <h4 className="line-clamp-1 text-xs font-semibold text-foreground">
                        {episode.title}
                      </h4>
                    </div>
                    <div className="text-[11px] text-foreground/60 flex items-center gap-2">
                      <span>{publishedDate}</span>
                      <span>·</span>
                      <span>{formatViewCount(episode.viewCount ?? 0)} views</span>
                    </div>
                  </div>

                  {/* Play Button */}
                  <div className="flex-shrink-0">
                    <PlayCircle className="h-5 w-5 text-primary group-hover:text-primary/80 transition-colors" />
                  </div>
                </Link>
              )
            })
          ) : (
            <p className="text-xs text-foreground/60">No episodes available</p>
          )}
        </div>

        {episodeCount > 5 && (
          <Link 
            href={`/episodes/${series.slug}#episodes`}
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            <span>View All Episodes</span>
            <span>→</span>
          </Link>
        )}
      </div>

      {/* Ad Slot - Sidebar */}
      <AdSlot slot="sidebar" label="Advertisement" />
      
      {/* Add Placement Section */}
      <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground">Add Placement</h3>
        <p className="text-xs text-foreground/70">
          Interested in advertising or partnering with us?
        </p>
        <Link 
          href="/contact"
          className="inline-block text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Get in touch →
        </Link>
      </div>
    </div>
  )
}
