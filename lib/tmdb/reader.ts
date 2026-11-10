import { logoUrl } from "./logos"

/** A logo as the pages need it. */
export type SeriesLogo = {
  url: string
  aspectRatio: number
  width: number
}

type LogoColumns = {
  logoPath?: string | null
  logoAspectRatio?: number | string | null
  logoWidth?: number | string | null
  logoCheckedAt?: Date | string | null
}

/**
 * The logo for a series row, or null. Pure and total: it never fetches, never
 * throws, and a missing or malformed path simply means "use the text title".
 * Pages must never make a TMDB call while rendering.
 */
export function getSeriesLogo(series: LogoColumns | null | undefined): SeriesLogo | null {
  if (!series) return null

  const url = logoUrl(series.logoPath)
  if (!url) return null

  const aspectRatio = Number(series.logoAspectRatio)
  const width = Number(series.logoWidth)

  return {
    url,
    aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 3,
    width: Number.isFinite(width) && width > 0 ? width : 1000,
  }
}

/** True while the logo pipeline has not looked at this series yet. */
export function isSeriesLogoPending(series: LogoColumns | null | undefined): boolean {
  return Boolean(series && !series.logoCheckedAt)
}
