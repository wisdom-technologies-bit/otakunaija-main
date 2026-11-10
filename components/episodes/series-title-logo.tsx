import type { SeriesLogo } from "@/lib/tmdb/reader"

/**
 * The TMDB wordmark for a series, when the logo pipeline has one.
 *
 * Plain <img> on purpose: `images.unoptimized` is on for this app, the logo is
 * a transparent PNG that must keep its aspect ratio, and the height is fixed so
 * a very wide wordmark cannot push the title off the hero.
 */
export function SeriesTitleLogo({ logo, title }: { logo: SeriesLogo | null; title: string }) {
  if (!logo) return null

  return (
    <img
      src={logo.url}
      alt=""
      aria-hidden="true"
      width={logo.width}
      height={Math.round(logo.width / logo.aspectRatio)}
      className="mb-1 h-10 w-auto max-w-[min(18rem,70%)] object-contain object-left md:h-14"
      loading="lazy"
      decoding="async"
      data-testid="series-title-logo"
    />
  )
}

export default SeriesTitleLogo
