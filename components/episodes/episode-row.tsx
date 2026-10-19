'use client'

import Link from 'next/link'
import { formatReleaseDate } from '@/lib/format-date'
import Image from 'next/image'
import { type Episode } from '@/lib/db/schema'
import { formatDuration, formatViewCount } from '@/lib/episode-utils'

type SerializedEpisode = Omit<Episode, 'publishedAt'> & { publishedAt: string | Date | null }

interface EpisodeRowProps {
  episode: SerializedEpisode
  seriesSlug: string
  seriesTitle?: string
}

export function EpisodeRow({ episode, seriesSlug, seriesTitle }: EpisodeRowProps) {
  const publishedDate = episode.publishedAt ? formatReleaseDate(typeof episode.publishedAt === 'string' ? episode.publishedAt : episode.publishedAt.toISOString()) : ''

  const durationStr = episode.durationSeconds
    ? formatDuration(episode.durationSeconds)
    : 'Unknown'

  return (
    <Link href={`/episodes/${seriesSlug}/${episode.slug}`}>
      <div className="group flex items-center gap-3 rounded-lg border border-border/40 p-2.5 transition-all hover:border-primary/40 hover:bg-card/60">
        {/* Thumbnail */}
         <div className="relative h-14 w-24 flex-shrink-0 overflow-hidden rounded bg-muted">
          {episode.thumbnailUrl ? (
            <Image
              src={episode.thumbnailUrl}
              alt={`Episode ${episode.episodeNumber}`}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="96px"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <span className="text-[10px] text-muted-foreground">No image</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col items-start gap-1 min-w-0 sm:flex-row sm:items-center sm:gap-2">
          <span className="flex-shrink-0 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            EP {episode.episodeNumber.toString().padStart(2, '0')}
          </span>
          <div className="min-w-0 w-full flex-1">
            <h3 className="line-clamp-1 text-sm font-bold text-foreground group-hover:text-primary transition-colors">
              {episode.title}
            </h3>
            {seriesTitle && (
              <p className="line-clamp-1 text-xs text-foreground/60">{seriesTitle}</p>
            )}
              <p className="mt-0.5 text-[11px] text-foreground/60 sm:hidden">
              {publishedDate}
              {publishedDate && durationStr !== 'Unknown' ? ' · ' : ''}
              {durationStr !== 'Unknown' ? durationStr : ''}
            </p>
          </div>
        </div>

        {/* Metadata column */}
        <div className="hidden flex-shrink-0 flex-col items-end gap-0.5 text-xs text-foreground/60 sm:flex">
          <span>{durationStr}</span>
          <span>{formatViewCount(episode.viewCount ?? 0)} views</span>
          <span>{publishedDate}</span>
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
