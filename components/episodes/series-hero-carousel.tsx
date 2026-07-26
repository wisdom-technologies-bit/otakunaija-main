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
    if (seriesList.length <= 1) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % seriesList.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [seriesList.length])

  if (seriesList.length === 0) return null
  const active = seriesList[activeIndex]

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="relative h-64 w-full max-w-full overflow-hidden rounded-xl bg-muted sm:h-72 md:h-96">
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
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            OtakuNaija Originals
          </p>
          <h1 className="mt-2 text-xl font-bold leading-tight text-foreground sm:text-2xl md:text-5xl">
            Watch Original Anime Episodes
          </h1>
          <p className="mt-2 max-w-xl text-xs text-foreground/70 sm:text-sm md:mt-3 md:max-w-2xl md:text-base">
            Discover exclusive anime series and episodes. Explore original content you won&apos;t find anywhere else.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 md:mt-6 md:gap-3">
            <Link
              href={`/episodes/${active.slug}`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:px-4 sm:text-sm md:px-5 md:py-2.5"
            >
              <Play className="h-4 w-4 fill-current" /> Start Watching
            </Link>
            <Link
              href="/episodes/browse"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-card sm:px-4 sm:text-sm md:px-5 md:py-2.5"
            >
              <LayoutGrid className="h-4 w-4" /> Browse All
            </Link>
          </div>
        </div>
      </div>

      {seriesList.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {seriesList.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              aria-label={`Show series ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-primary/50'
                }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}