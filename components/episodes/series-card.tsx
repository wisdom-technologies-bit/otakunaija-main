'use client'

import Link from 'next/link'
import Image from 'next/image'
import { type Series } from '@/lib/db/schema'

interface SeriesCardProps {
  series: Series & { episodeCount?: number }
  creatorName?: string
  variant?: 'poster' | 'default'
}

export function SeriesCard({ series, creatorName, variant = 'poster' }: SeriesCardProps) {
  const genreTag = series.genre || 'Anime'
  const statusColor = series.status === 'ongoing' ? 'bg-emerald-900/70' : 'bg-slate-900/70'
  const statusLabel = series.status === 'ongoing' ? 'Ongoing' : 'Completed'

  if (variant === 'poster') {
    return (
      <Link href={`/episodes/${series.slug}`}>
        <div className="group flex flex-col gap-2">
          {/* Poster Image Container - 9:16 aspect ratio */}
          <div className="relative w-full overflow-hidden rounded-lg border border-border/60 bg-muted transition-all hover:border-primary/40 hover:shadow-lg" style={{ aspectRatio: '9/16' }}>
            {series.posterImageUrl ? (
              <Image
                src={series.posterImageUrl}
                alt={series.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                <span className="text-xs text-muted-foreground">No image</span>
              </div>
            )}

            {/* Overlay with gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Episode Count and Status - Bottom Left and Right corners inside poster */}
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-3 text-white">
              {series.episodeCount !== undefined && (
                <p className="text-xs font-medium border border-red-500 bg-red-500 rounded px-2 py-1">
                  Ep {series.episodeCount}
                </p>
              )}
              <div className={`rounded-full ${statusColor} px-2 py-1 text-xs font-medium`}>
                {statusLabel}
              </div>
            </div>
          </div>

          {/* Series Name - Below Poster */}
          <div className="flex flex-col gap-1">
            <h3 className="line-clamp-2 font-bold text-sm text-foreground group-hover:text-primary transition-colors">
              {series.title}
            </h3>
          </div>
        </div>
      </Link>
    )
  }

  // Default variant - kept for backward compatibility
  return (
    <Link href={`/episodes/${series.slug}`}>
      <div className="group h-full overflow-hidden rounded-lg border border-border/60 bg-card transition-all hover:border-primary/40 hover:shadow-lg">
        {/* Image Container */}
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {series.coverImageUrl ? (
            <Image
              src={series.coverImageUrl}
              alt={series.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          )}

          {/* Genre Badge - Top Left */}
          <div className="absolute left-2 top-2 rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground">
            {genreTag}
          </div>

          {/* Status Badge - Top Right */}
          <div className={`absolute right-2 top-2 rounded-full ${statusColor} px-3 py-1 text-xs font-medium text-white`}>
            {statusLabel}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-2 p-4">
          <h3 className="line-clamp-2 font-bold text-foreground group-hover:text-primary transition-colors">
            {series.title}
          </h3>

          {creatorName && (
            <p className="text-xs text-muted-foreground">
              by <span className="text-foreground/80">{creatorName}</span>
            </p>
          )}

          <p className="line-clamp-1 text-xs leading-relaxed text-foreground/70">
            {series.synopsis || 'No synopsis available'}
          </p>

          {series.episodeCount !== undefined && (
            <div className="mt-1 text-xs font-medium text-primary/80">
              {series.episodeCount} Episode{series.episodeCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
