'use client'

import Link from 'next/link'
import Image from 'next/image'
import { type Episode } from '@/lib/db/schema'
import { formatDuration, formatViewCount } from '@/lib/episode-utils'

interface EpisodeRowProps {
  episode: Episode
  seriesSlug: string
  seriesTitle?: string
}

export function EpisodeRow({ episode, seriesSlug, seriesTitle }: EpisodeRowProps) {
  const publishedDate = new Date(episode.publishedAt || new Date()).toLocaleDateString(
    'en-US',
    { year: 'numeric', month: 'short', day: 'numeric' }
  )

  const durationStr = episode.durationSeconds
    ? formatDuration(episode.durationSeconds)
    : 'Unknown'

  return (
    <Link href={`/episodes/${seriesSlug}/${episode.slug}`}>
      <div className="group flex items-center gap-3 rounded-lg border border-border/40 p-2.5 transition-all hover:border-primary/40 hover:bg-card/60">
        {/* Thumbnail */}
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded bg-muted">
          {episode.thumbnailUrl ? (
            <Image
              src={episode.thumbnailUrl}
              alt={`Episode ${episode.episodeNumber}`}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="56px"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <span className="text-[10px] text-muted-foreground">No image</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              EP {episode.episodeNumber.toString().padStart(2, '0')}
            </span>
            <h3 className="line-clamp-1 text-sm font-bold text-foreground group-hover:text-primary transition-colors">
              {episode.title}
            </h3>
          </div>

          <p className="line-clamp-1 mt-0.5 text-xs text-foreground/70">
            {episode.synopsis || 'No synopsis available'}
          </p>

          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/60">
            <span>{durationStr}</span>
            <span>•</span>
            <span>{formatViewCount(episode.viewCount)} views</span>
            <span>•</span>
            <span>{publishedDate}</span>
          </div>
        </div>

        {/* Chevron */}
        <svg
          className="h-4 w-4 flex-shrink-0 text-foreground/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
