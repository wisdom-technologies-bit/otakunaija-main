'use client'

import Link from 'next/link'
import { type Episode } from '@/lib/db/schema'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface EpisodeNavigationProps {
  seriesSlug: string
  currentEpisode: Episode
  previousEpisode?: Episode | null
  nextEpisode?: Episode | null
}

export function EpisodeNavigation({
  seriesSlug,
  currentEpisode,
  previousEpisode,
  nextEpisode,
}: EpisodeNavigationProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {previousEpisode ? (
        <Link href={`/episodes/${seriesSlug}/${previousEpisode.slug}`}>
          <button className="w-full flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2 font-medium text-primary transition-all hover:bg-primary/20 active:scale-95">
            <ChevronLeft className="h-4 w-4" />
            Previous Episode
          </button>
        </Link>
      ) : (
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-muted px-4 py-2 font-medium text-muted-foreground cursor-not-allowed opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous Episode
        </button>
      )}

      {nextEpisode ? (
        <Link href={`/episodes/${seriesSlug}/${nextEpisode.slug}`}>
          <button className="w-full flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2 font-medium text-primary transition-all hover:bg-primary/20 active:scale-95">
            Next Episode
            <ChevronRight className="h-4 w-4" />
          </button>
        </Link>
      ) : (
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-muted px-4 py-2 font-medium text-muted-foreground cursor-not-allowed opacity-50"
        >
          Next Episode
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
