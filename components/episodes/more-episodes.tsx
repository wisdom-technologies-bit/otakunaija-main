'use client'

import Link from 'next/link'
import Image from 'next/image'
import { type Episode } from '@/lib/db/schema'
import { formatDuration } from '@/lib/episode-utils'

interface MoreEpisodesProps {
  episodes: Episode[]
  currentEpisodeId: number
  seriesSlug: string
}

export function MoreEpisodes({
  episodes,
  currentEpisodeId,
  seriesSlug,
}: MoreEpisodesProps) {
  const otherEpisodes = episodes.filter((ep) => ep.id !== currentEpisodeId)

  if (otherEpisodes.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground">More Episodes in This Series</h3>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {otherEpisodes.map((episode) => {
          const durationStr = episode.durationSeconds
            ? formatDuration(episode.durationSeconds)
            : 'Unknown'

          return (
            <Link
              key={episode.id}
              href={`/episodes/${seriesSlug}/${episode.slug}`}
              className="group flex-shrink-0 w-40"
            >
              <div className="space-y-2">
                {/* Thumbnail */}
                <div className="relative h-24 w-40 overflow-hidden rounded bg-muted">
                  {episode.thumbnailUrl ? (
                    <Image
                      src={episode.thumbnailUrl}
                      alt={`Episode ${episode.episodeNumber}`}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="160px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <span className="text-xs text-muted-foreground">No image</span>
                    </div>
                  )}

                  {/* Episode Number */}
                  <div className="absolute right-1 top-1 rounded bg-primary/90 px-2 py-0.5 text-xs font-bold text-primary-foreground">
                    EP {episode.episodeNumber.toString().padStart(2, '0')}
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-1">
                  <h4 className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {episode.title}
                  </h4>
                  <p className="text-xs text-foreground/60">{durationStr}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
