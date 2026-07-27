'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Play, LayoutGrid } from 'lucide-react'
import { type Series } from '@/lib/db/schema'

interface SeriesHeroCarouselProps {
  seriesList: (Series & { episodeCount?: number })[]
}

export function SeriesHeroCarousel({ seriesList }: SeriesHeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!seriesList || seriesList.length <= 1) return

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % seriesList.length)
    }, 6000)

    return () => clearInterval(timer)
  }, [seriesList])

  if (seriesList.length === 0) return null
  const active = seriesList[activeIndex]

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="relative h-60 w-full max-w-full overflow-hidden rounded-xl bg-muted sm:h-72 md:h-96">
        {active.coverImageUrl && (
          <Image
            src={active.coverImageUrl}
            alt={active.title}
            fill
            priority
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5 md:p-8">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-primary">
            OtakuNaija Originals
          </p>
          <h2 className="mt-1 text-base sm:text-2xl md:text-4xl font-bold leading-tight text-foreground line-clamp-1">
            {active.title}
          </h2>
          <p className="mt-1 max-w-xl text-[11px] sm:text-sm text-foreground/80 md:mt-2 md:max-w-2xl md:text-base line-clamp-2">
            {active.description || 'Discover exclusive anime series and episodes.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 md:mt-4 md:gap-3">
            <Link
              href={`/episodes/${active.slug}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:px-4 sm:text-sm md:px-5 md:py-2.5"
            >
              <Play className="h-3.5 w-3.5 fill-current" /> Start Watching
            </Link>
            <Link
              href="/episodes/browse"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-card sm:px-4 sm:text-sm md:px-5 md:py-2.5"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Browse All
            </Link>
          </div>
        </div>
      </div>

      {seriesList.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {seriesList.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              aria-label={`Show series ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === activeIndex ? 'w-5 bg-primary' : 'w-1.5 bg-border hover:bg-primary/50'
                }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}