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
      <div className="group flex gap-4 rounded-lg border border-border/40 p-3 transition-all hover:border-primary/40 hover:bg-card/60">
        {/* Thumbnail */}
        <div className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded bg-muted">
          {episode.thumbnailUrl ? (
            <Image
              src={episode.thumbnailUrl}
              alt={`Episode ${episode.episodeNumber}`}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="128px"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          )}

          {/* Episode Number Badge */}
          <div className="absolute right-1 top-1 rounded-full bg-primary/90 px-2 py-0.5 text-xs font-bold text-primary-foreground shadow-md">
            EP {episode.episodeNumber.toString().padStart(2, '0')}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-center min-w-0">
          {seriesTitle && (
            <p className="text-xs text-foreground/60 mb-1">
              {seriesTitle}
            </p>
          )}
          <h3 className="line-clamp-1 font-bold text-foreground group-hover:text-primary transition-colors">
            {episode.title}
          </h3>

          <p className="line-clamp-1 text-xs text-foreground/70">
            {episode.synopsis || 'No synopsis available'}
          </p>

          {/* Metadata */}
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/60">
            <span>{durationStr}</span>
            <span>•</span>
            <span>{formatViewCount(episode.viewCount)} views</span>
            <span>•</span>
            <span>{publishedDate}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
