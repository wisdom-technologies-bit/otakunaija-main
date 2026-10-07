'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Play, LayoutGrid, Flame } from 'lucide-react'
import { type Series } from '@/lib/db/schema'
import { splitGenres } from '@/lib/genres'

interface SeriesHeroCarouselProps {
  seriesList: (Series & { episodeCount?: number })[]
}

function plainText(markdown: string | null | undefined) {
  return (markdown ?? '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function SeriesHeroCarousel({ seriesList }: SeriesHeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = seriesList?.length ?? 0
  if (!count) return null

  const index = activeIndex % count
  const active = seriesList[index]
  const art = active.coverImageUrl || active.posterImageUrl
  const genres = splitGenres(active.genre).slice(0, 3)
  const summary = plainText(active.synopsis) || 'Discover exclusive anime series and episodes.'

  return (
    <div className="w-full max-w-full">
      <div
        className="relative isolate h-60 overflow-hidden rounded-2xl border border-white/10 bg-black sm:h-72 md:h-[24rem]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div key={active.id} className="absolute inset-0 animate-in fade-in duration-700">
          {art && (
            <Image
              src={art}
              alt={active.title}
              fill
              priority={index === 0}
              sizes="(min-width: 1280px) 1200px, 100vw"
              className="object-cover object-[center_20%]"
            />
          )}
        </div>

        {/* anime-style overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/75 to-transparent md:via-background/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:5px_5px] [mask-image:linear-gradient(to_right,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-primary" />
        <div className="pointer-events-none absolute -right-6 top-0 hidden h-full w-3 -skew-x-12 bg-primary/80 md:block" />
        <div className="pointer-events-none absolute -right-14 top-0 hidden h-full w-8 -skew-x-12 bg-primary/30 md:block" />

        {/* content */}
        <div
          key={`c-${active.id}`}
          className="absolute inset-0 flex flex-col justify-end gap-2 p-4 pl-5 animate-in fade-in slide-in-from-bottom-2 duration-700 sm:p-6 sm:pl-8 md:max-w-[62%] md:gap-3 md:p-10"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex -skew-x-12 items-center gap-1 rounded-sm bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-primary-foreground">
              <Flame className="h-3 w-3" /> #{index + 1} Spotlight
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-white/20 bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/90 backdrop-blur">
              <span className={`h-1.5 w-1.5 rounded-full ${active.status === 'ongoing' ? 'animate-pulse bg-emerald-400' : 'bg-slate-400'}`} />
              {active.status === 'ongoing' ? 'Ongoing' : 'Completed'}
            </span>
          </div>

          <h2 className="font-display line-clamp-2 text-2xl font-extrabold uppercase italic leading-[1.05] tracking-tight text-foreground drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:text-4xl md:text-5xl">
            {active.title}
          </h2>

          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <span key={g} className="rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {g}
                </span>
              ))}
            </div>
          )}

          <p className="line-clamp-2 max-w-xl text-xs text-foreground/80 sm:text-sm md:line-clamp-3 md:text-base">
            {summary}
          </p>

          <div className="mt-1 flex flex-wrap gap-2 md:gap-3">
            <Link
              href={`/episodes/${active.slug}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 sm:text-sm md:px-5 md:py-2.5"
            >
              <Play className="h-3.5 w-3.5 fill-current" /> Start Watching
            </Link>
            <Link
              href="/episodes/browse"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-black/40 px-3.5 py-2 text-xs font-semibold text-foreground backdrop-blur transition hover:bg-black/60 sm:text-sm md:px-5 md:py-2.5"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Browse All
            </Link>
          </div>
        </div>

        {/* tilted poster (desktop) */}
        {active.posterImageUrl && (
          <div
            key={`p-${active.id}`}
            className="absolute bottom-6 right-10 hidden w-36 rotate-3 overflow-hidden rounded-xl border-2 border-white/25 shadow-2xl shadow-black/60 ring-1 ring-primary/50 animate-in fade-in slide-in-from-right-4 duration-700 md:block lg:w-44"
          >
            <div className="relative aspect-[2/3]">
              <Image src={active.posterImageUrl} alt={`${active.title} poster`} fill sizes="176px" className="object-cover" />
            </div>
          </div>
        )}

        {/* progress bar advances the slide */}
        {count > 1 && (
          <div
            key={index}
            className="hero-progress absolute inset-x-0 bottom-0 h-0.5 bg-primary"
            style={{ animationPlayState: paused ? 'paused' : 'running' }}
            onAnimationEnd={() => setActiveIndex((i) => (i + 1) % count)}
          />
        )}
      </div>

      {count > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {seriesList.map((s, i) => {
            const thumb = s.posterImageUrl || s.coverImageUrl
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`Show ${s.title}`}
                aria-current={i === index}
                className={`relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-md border transition-all ${
                  i === index ? 'border-primary ring-2 ring-primary/60' : 'border-border opacity-60 hover:opacity-100'
                }`}
              >
                {thumb && <Image src={thumb} alt="" fill sizes="40px" className="object-cover" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
