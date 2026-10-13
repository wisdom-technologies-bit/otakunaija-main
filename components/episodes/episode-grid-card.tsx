'use client'

import Link from 'next/link'
import Image from 'next/image'
import { formatReleaseDate } from '@/lib/format-date'
import { type Episode } from '@/lib/db/schema'
import { formatDuration, formatViewCount } from '@/lib/episode-utils'
import { Play } from 'lucide-react'

type SerializedEpisode = Omit<Episode, 'publishedAt'> & { publishedAt: string | null }

interface EpisodeGridCardProps {
  episode: SerializedEpisode
  seriesSlug: string
}

export function EpisodeGridCard({ episode, seriesSlug }: EpisodeGridCardProps) {
  const publishedDate = episode.publishedAt ? formatReleaseDate(episode.publishedAt) : ''

  const ageMs = episode.publishedAt ? Date.now() - new Date(episode.publishedAt).getTime() : -1
  const isNew = ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000

  const durationStr = episode.durationSeconds
    ? formatDuration(episode.durationSeconds)
    : '24 min'

  return (
    <Link href={`/episodes/${seriesSlug}/${episode.slug}`}>
      <div className="group flex flex-col gap-3 rounded-lg border border-border/40 overflow-hidden transition-all hover:border-primary/40 hover:bg-card/60">
        {/* Thumbnail Container */}
        <div className="relative aspect-video overflow-hidden bg-muted">
          {episode.thumbnailUrl ? (
            <Image
              src={episode.thumbnailUrl}
              alt={`Episode ${episode.episodeNumber}`}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          )}

          {/* Overlay with Play Button */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="rounded-full bg-primary p-3 shadow-lg">
              <Play className="h-6 w-6 text-primary-foreground fill-primary-foreground" />
            </div>
          </div>

          {/* Episode Badge */}
          <div className="absolute top-2 left-2">
            <span className="rounded bg-red-600/90 px-2 py-1 text-[11px] font-bold text-white">
              EP {episode.episodeNumber.toString().padStart(4, '0')}
            </span>
          </div>

          {isNew && (
            <div className="absolute top-2 right-2">
              <span className="rounded bg-emerald-600/90 px-2 py-1 text-[11px] font-bold text-white">NEW</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-2 px-3 pb-3">
          {/* Title */}
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {episode.title}
          </h3>

          {/* Metadata */}
          <div className="flex items-center gap-2 text-xs text-foreground/60">
            <span>{publishedDate}</span>
            <span>·</span>
            <span>{durationStr}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
