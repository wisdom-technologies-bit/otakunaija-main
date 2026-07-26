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
    <div>
      <div className="relative h-80 w-full overflow-hidden rounded-xl bg-muted md:h-96">
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
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            OtakuNaija Originals
          </p>
          <h1 className="mt-2 text-3xl font-bold text-foreground md:text-5xl">
            Watch Original Anime Episodes
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-foreground/70 md:text-base">
            Discover exclusive anime series and episodes. Explore original content you won&apos;t find anywhere else.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href={`/episodes/${active.slug}`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Play className="h-4 w-4 fill-current" /> Start Watching
            </Link>
            <Link
              href="/episodes/browse"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-card"
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
              className={`h-2 rounded-full transition-all ${
                i === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-primary/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}