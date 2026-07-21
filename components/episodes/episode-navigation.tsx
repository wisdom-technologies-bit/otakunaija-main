'use client'

import { useState } from 'react'
import Link from 'next/link'
import { type Episode } from '@/lib/db/schema'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'

interface EpisodeNavigationProps {
  seriesSlug: string
  currentEpisode: Episode
  previousEpisode?: Episode | null
  nextEpisode?: Episode | null
  allEpisodes: Episode[]
}

export function EpisodeNavigation({
  seriesSlug,
  currentEpisode,
  previousEpisode,
  nextEpisode,
  allEpisodes,
}: EpisodeNavigationProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Calculate window of visible episodes in compact mode (show ±1 episodes from current)
  const windowSize = 4
  const halfWindow = Math.floor(windowSize / 2)
  const minEp = Math.max(1, currentEpisode.episodeNumber - halfWindow)
  const maxEp = Math.min(allEpisodes.length, minEp + windowSize - 1)
  const actualMin = Math.max(1, maxEp - windowSize + 1)

  const visibleEpisodes = allEpisodes.filter(
    ep => ep.episodeNumber >= actualMin && ep.episodeNumber <= maxEp
  )

  const hasMore = allEpisodes.length > windowSize

  if (isExpanded) {
    // Expanded grid view — 7 columns to match the compact row's box size
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {allEpisodes.map((ep) => {
            const digitCount = ep.episodeNumber.toString().length
            const fontSizeClass =
              digitCount >= 4 ? 'text-[10px]' : digitCount === 3 ? 'text-xs' : 'text-sm'

            return (
              <Link
                key={ep.id}
                href={`/episodes/${seriesSlug}/${ep.slug}`}
                className={`aspect-square flex items-center justify-center rounded-lg border-2 font-bold ${fontSizeClass} transition-all ${ep.id === currentEpisode.id
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-border/60 bg-card hover:border-primary/50 hover:bg-card/80 text-foreground/80 hover:text-foreground'
                  }`}
              >
                {ep.episodeNumber}
              </Link>
            )
          })}
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-card/80 transition-colors"
        >
          <ChevronUp className="h-4 w-4" />
          Show Less
        </button>
      </div>
    )
  }

  // Compact row view
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Previous button */}
      {previousEpisode ? (
        <Link href={`/episodes/${seriesSlug}/${previousEpisode.slug}`}>
          <button className="flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 font-medium text-primary transition-all hover:bg-primary/20 active:scale-95">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Prev</span>
          </button>
        </Link>
      ) : (
        <button
          disabled
          className="flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-muted px-3 py-2 font-medium text-muted-foreground cursor-not-allowed opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>
      )}

      {/* Next button */}
      {nextEpisode ? (
        <Link href={`/episodes/${seriesSlug}/${nextEpisode.slug}`}>
          <button className="flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 font-medium text-primary transition-all hover:bg-primary/20 active:scale-95">
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </Link>
      ) : (
        <button
          disabled
          className="flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-muted px-3 py-2 font-medium text-muted-foreground cursor-not-allowed opacity-50"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Episode number buttons window */}
      {visibleEpisodes.map((ep) => {
        const digitCount = ep.episodeNumber.toString().length
        const fontSizeClass =
          digitCount >= 4 ? 'text-[10px]' : digitCount === 3 ? 'text-xs' : 'text-sm'

        return (
          <Link
            key={ep.id}
            href={`/episodes/${seriesSlug}/${ep.slug}`}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border font-bold ${fontSizeClass} transition-all ${
              ep.id === currentEpisode.id
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-border/60 bg-card hover:border-primary/50 hover:bg-card/80 text-foreground/80 hover:text-foreground'
            }`}
          >
            {ep.episodeNumber}
          </Link>
        )
      })}

      {/* Expand button if there are more episodes */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-card px-2 py-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
          aria-label="Show all episodes"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
