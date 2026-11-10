'use client'

import { useEffect, useState } from 'react'
import { logoUrl } from '@/lib/tmdb/logos'
import { logoState, safeLogoAspect, safeLogoWidth } from '@/lib/episode-ui'

export type SeriesLogoProps = {
  /** The real title. Always in the DOM for search engines and screen readers. */
  title: string
  /** TMDB file path (`/abc.png`). Missing or unusable means the text title. */
  logoPath?: string | null
  /** TMDB aspect ratio (width / height) so the box is reserved before paint. */
  aspect?: number | string | null
  /** Intrinsic width in px. */
  width?: number | string | null
  /** Rendered height cap. Numbers are px. */
  maxHeight?: number | string
  /** Size requested from TMDB. */
  size?: 'w300' | 'w500' | 'w780' | 'original'
  /** Layout classes for the text-title fallback. */
  textClassName?: string
  /** Layout classes for the logo image. */
  logoClassName?: string
  /** Eager loading for the one above-the-fold use (first hero slide). */
  priority?: boolean
  /** Visually-hidden heading level for the fallback copy. */
  as?: 'h1' | 'h2' | 'p' | 'span'
  className?: string
}

const toCssSize = (value: number | string | undefined) =>
  value === undefined ? undefined : typeof value === 'number' ? `${value}px` : value

/**
 * One title treatment for all three /episodes surfaces.
 *
 * Shows the TMDB wordmark when the pipeline found one, and the styled text title
 * otherwise. Never both: the logo is decorative (`alt=""`) while the real title
 * stays in the DOM as visually hidden text, so the accessible name and the
 * document outline survive whichever branch renders. A broken logo image falls
 * back to the text title instead of leaving a hole.
 */
export function SeriesLogo({
  title,
  logoPath,
  aspect,
  width,
  maxHeight,
  size = 'w500',
  textClassName = '',
  logoClassName = '',
  priority = false,
  as: TextTag = 'span',
  className = '',
}: SeriesLogoProps) {
  const [broken, setBroken] = useState(false)
  const url = logoUrl(logoPath, size)

  // A different logo path is a different image: clear the failure flag.
  useEffect(() => {
    setBroken(false)
  }, [url])

  const state = logoState(url, broken)
  const ratio = safeLogoAspect(aspect)
  const intrinsicWidth = safeLogoWidth(width)
  const maxHeightCss = toCssSize(maxHeight)

  if (state === 'text') {
    return (
      <TextTag className={`${textClassName} ${className}`} data-testid="series-logo-text">
        {title}
      </TextTag>
    )
  }

  return (
    <span className={className}>
      {/* Plain <img>: the app runs with images.unoptimized, and these are
          transparent PNGs that must keep their own aspect ratio. */}
      <img
        src={url ?? undefined}
        alt=""
        aria-hidden="true"
        width={intrinsicWidth}
        height={Math.max(1, Math.round(intrinsicWidth / ratio))}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        onError={() => setBroken(true)}
        className={logoClassName}
        style={{ aspectRatio: ratio, maxHeight: maxHeightCss, width: 'auto', height: 'auto' }}
        data-testid="series-logo-image"
        data-logo-state="logo"
      />
      {/* The real title keeps its heading level even when the artwork shows. */}
      <TextTag className="sr-only">{title}</TextTag>
    </span>
  )
}

export default SeriesLogo
