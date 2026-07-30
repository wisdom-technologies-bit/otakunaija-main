'use client'

import Link from 'next/link'
import Image from 'next/image'
import { type Series } from '@/lib/db/schema'
import { AdSlot } from '@/components/ad-slot'

interface AboutSeriesSidebarProps {
  series: Series
  episodeCount: number
}

export function AboutSeriesSidebar({ series, episodeCount }: AboutSeriesSidebarProps) {
  // Format episode count: 1-99 = "##", 100+ = "100+", 200+ = "200+", etc
  const episodeCountDisplay = episodeCount >= 100 
    ? `${Math.floor(episodeCount / 100) * 100}+`
    : episodeCount.toString()

  return (
    <div className="space-y-6">
      {/* About Series Card */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">About {series.title}</h2>
        
        {/* Poster Image */}
        <div className="relative w-full overflow-hidden rounded-lg border border-border/60 bg-muted" style={{ aspectRatio: '9/16' }}>
          {series.posterImageUrl ? (
            <Image
              src={series.posterImageUrl}
              alt={series.title}
              fill
              className="object-cover"
              sizes="320px"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <span className="text-xs text-muted-foreground">No image</span>
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

      {/* Episodes Count Card */}
      <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground">Episodes ({episodeCountDisplay})</h3>
        <p className="text-xs text-foreground/70">
          {episodeCount > 1 
            ? `${episodeCount} episodes available to watch`
            : '1 episode available to watch'
          }
        </p>
        <Link 
          href={`/episodes/${series.slug}`}
          className="inline-block text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View All Episodes →
        </Link>
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
