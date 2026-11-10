'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Info, Play } from 'lucide-react'
import { type Series } from '@/lib/db/schema'
import { splitGenres } from '@/lib/genres'
import { episodeCountLabel } from '@/lib/episode-ui'
import { isUpcomingSeries, seriesStatusClass, seriesStatusLabel } from '@/lib/series-upcoming'
import { SeriesLogo } from '@/components/episodes/series-logo'

/** Same props as before, plus the optional per-series episode hints the page now sends. */
export type HeroSeries = Series & {
  episodeCount?: number
  latestEpisodeSlug?: string | null
  latestEpisodeNumber?: number | null
}

interface SeriesHeroCarouselProps {
  seriesList: HeroSeries[]
  /** Dwell time per slide in ms. */
  intervalMs?: number
}

function plainText(markdown: string | null | undefined) {
  return (markdown ?? '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function watchHref(series: HeroSeries) {
  if (!isUpcomingSeries(series)) {
    const slug = series.latestEpisodeSlug
    if (slug) return `/episodes/${series.slug}/${slug}`
  }
  return `/episodes/${series.slug}`
}

/**
 * The /episodes hero: one cinematic banner per series, autoplaying every 7s.
 *
 * Autoplay is a courtesy, not a requirement: it stops on hover, focus, touch and
 * a hidden tab, and never starts at all under `prefers-reduced-motion`. The
 * first slide's artwork is eager (it is the LCP); every other slide is lazy.
 */
export function SeriesHeroCarousel({ seriesList, intervalMs = 7000 }: SeriesHeroCarouselProps) {
  const count = seriesList?.length ?? 0
  const [activeIndex, setActiveIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [touched, setTouched] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const index = count ? activeIndex % count : 0
  const active = count ? seriesList[index] : null

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReducedMotion(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const paused = hovered || focused || touched || hidden || reducedMotion

  const goTo = useCallback(
    (next: number) => {
      if (!count) return
      setActiveIndex(((next % count) + count) % count)
    },
    [count],
  )

  const next = useCallback(() => goTo(index + 1), [goTo, index])
  const previous = useCallback(() => goTo(index - 1), [goTo, index])

  useEffect(() => {
    if (paused || count < 2) return
    const timer = window.setTimeout(next, intervalMs)
    return () => window.clearTimeout(timer)
  }, [paused, count, next, intervalMs, index])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      next()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      previous()
    }
  }

  const slides = useMemo(
    () =>
      seriesList.map((series) => ({
        series,
        art: series.coverImageUrl || series.posterImageUrl || null,
        genres: splitGenres(series.genre).slice(0, 3),
        synopsis: plainText(series.synopsis),
      })),
    [seriesList],
  )

  if (!count || !active) return null

  const activeGenres = splitGenres(active.genre).slice(0, 3)
  const synopsis = plainText(active.synopsis) || 'Discover exclusive anime series and episodes.'
  const year =
    active.seasonYear ??
    active.startYear ??
    (active.createdAt ? new Date(active.createdAt).getFullYear() : null)
  const total =
    active.episodeCount && active.episodeCount > 0 ? active.episodeCount : active.latestEpisodeNumber ?? null
  const upcoming = isUpcomingSeries(active)
  const countLabel = upcoming ? 'Upcoming' : episodeCountLabel(total || null, active.status)
  const seasonLabel = active.season ? active.season.replace(/^\w/, (c) => c.toUpperCase()) : null

  return (
    <div
      className="otk-hero"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured series"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      data-testid="episodes-hero"
      data-paused={paused ? 'true' : 'false'}
    >
      <div
        className="otk-hero-frame"
        onTouchStart={(event) => {
          const touch = event.touches[0]
          touchStart.current = { x: touch.clientX, y: touch.clientY }
          setTouched(true)
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current
          touchStart.current = null
          if (!start) return
          const touch = event.changedTouches[0]
          const dx = touch.clientX - start.x
          const dy = touch.clientY - start.y
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) next()
            else previous()
          }
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.series.id}
            className="otk-hero-slide"
            data-active={i === index}
            aria-hidden={i === index ? undefined : true}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${slide.series.title}`}
          >
            {slide.art ? (
              <img
                src={slide.art}
                alt={`${slide.series.title} banner`}
                className="otk-hero-image"
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding={i === 0 ? 'sync' : 'async'}
                width={1600}
                height={900}
                data-testid={i === 0 ? 'hero-image-first' : 'hero-image-lazy'}
              />
            ) : (
              <div className="otk-hero-image otk-cover-fallback otk-fallback-default" aria-hidden="true" />
            )}
            <div className="otk-hero-scrim" />
            <div className="otk-hero-shade" />
          </div>
        ))}

        <div className="otk-hero-content">
          <div className="otk-hero-topline">
            <span className={`otk-chip ${seriesStatusClass(active.status)}`}>
              {seriesStatusLabel(active.status)}
            </span>
            {active.format ? <span className="otk-chip">{active.format}</span> : null}
          </div>

          <SeriesLogo
            title={active.title}
            logoPath={active.logoPath}
            aspect={active.logoAspectRatio}
            width={active.logoWidth}
            maxHeight="clamp(56px, 12vw, 140px)"
            priority={index === 0}
            as="h2"
            textClassName="otk-hero-title otk-hero-title-clamp"
            logoClassName="otk-hero-logo"
          />

          <div className="otk-hero-meta">
            {year ? <span>{year}</span> : null}
            {seasonLabel ? (
              <>
                <span className="otk-hero-meta-sep" aria-hidden="true">•</span>
                <span>{seasonLabel}</span>
              </>
            ) : null}
            <span className="otk-hero-meta-sep" aria-hidden="true">•</span>
            <span>{countLabel}</span>
            {activeGenres.length > 0 ? (
              <>
                <span className="otk-hero-meta-sep" aria-hidden="true">•</span>
                <span>{activeGenres.join(' · ')}</span>
              </>
            ) : null}
          </div>

          <p className="otk-hero-synopsis">{synopsis}</p>

          <div className="otk-hero-actions">
            <Link
              href={watchHref(active)}
              className="otk-btn otk-btn-primary otk-focus"
              data-testid="hero-primary-action"
            >
              <Play className="h-4 w-4 fill-current" />
              {upcoming ? 'View details' : 'Watch Now'}
            </Link>
            <Link href={`/episodes/${active.slug}`} className="otk-btn otk-btn-ghost otk-focus">
              <Info className="h-4 w-4" />
              Details
            </Link>
          </div>
        </div>

        {count > 1 ? (
          <div className="otk-hero-dots" role="tablist" aria-label="Choose a featured series">
            {seriesList.map((series, i) => (
              <button
                key={series.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show ${series.title}`}
                data-active={i === index}
                data-testid={`hero-dot-${i}`}
                className="otk-hero-dot otk-focus"
                onClick={() => goTo(i)}
              >
                <span
                  key={`${i}-${index}`}
                  className="otk-hero-dot-fill"
                  style={{ animationPlayState: paused ? 'paused' : 'running' }}
                />
              </button>
            ))}
          </div>
        ) : null}

        {count > 1 ? (
          <div className="otk-hero-thumbs" aria-hidden="true">
            {seriesList.map((series, i) => (
              <button
                key={series.id}
                type="button"
                tabIndex={-1}
                data-active={i === index}
                className="otk-hero-thumb"
                onClick={() => goTo(i)}
                style={{ aspectRatio: '2 / 3' }}
              >
                {series.posterImageUrl ? (
                  <img
                    src={series.posterImageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={116}
                    height={174}
                  />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default SeriesHeroCarousel
