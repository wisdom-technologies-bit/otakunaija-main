/**
 * Image URLs for email.
 *
 * Email clients do not render AVIF/WebP reliably (Outlook and older Gmail
 * proxy pipelines fall back to the first frame or nothing at all), so anything
 * we can control is forced to a Cloudinary JPG at an explicit width. AniList
 * covers are requested at their natural size: their CDN already serves JPG at
 * 230x326 and adding a transform would require an account we do not have.
 *
 * Everything here is pure so the render tests can assert "no relative URLs".
 */

export type ImageRequest = {
  /** Display width in CSS pixels; also the requested asset width. */
  width: 600 | 300 | 160 | 80
  /** Tall crops for posters, wide for heroes. */
  crop?: "fill" | "fit" | "limit"
}

const CLOUDINARY_HOST = "res.cloudinary.com"
const ANILIST_HOST = /(^|\.)anilist\.co$/i

function parse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function isTransformSegment(segment: string): boolean {
  return /(^|,)([a-z]{1,3}_|e_|dpr_|ar_)/i.test(segment)
}

/**
 * Rebuilds a Cloudinary delivery URL with our own transform. Any existing
 * transform segment is replaced rather than stacked, so the same source image
 * always produces one predictable asset.
 */
export function cloudinaryEmailUrl(url: string, request: ImageRequest): string | null {
  const parsed = parse(url)
  if (!parsed) return null
  if (!parsed.hostname.toLowerCase().endsWith(CLOUDINARY_HOST)) return null

  const marker = "/image/upload/"
  const index = parsed.pathname.indexOf(marker)
  if (index === -1) return null

  const head = parsed.pathname.slice(0, index + marker.length)
  const rest = parsed.pathname.slice(index + marker.length)
  const segments = rest.split("/").filter(Boolean)
  if (!segments.length) return null

  if (segments.length > 1 && isTransformSegment(segments[0])) segments.shift()

  const transform =
    request.crop === "fit"
      ? `f_jpg,q_auto:good,w_${request.width},c_limit`
      : `f_jpg,q_auto:good,w_${request.width},c_fill,g_auto`

  parsed.pathname = `${head}${transform}/${segments.join("/")}`
  parsed.search = ""
  return parsed.toString()
}

/**
 * The URL to put in an <img src>. Returns null when the value cannot be used in
 * an email at all (relative path, data URI, http), so the renderer can drop the
 * image and fall back to a typographic block instead of shipping a broken one.
 */
export function emailImageUrl(
  url: string | null | undefined,
  request: ImageRequest,
): string | null {
  const raw = (url ?? "").trim()
  if (!raw) return null
  if (raw.startsWith("data:")) return null
  if (raw.startsWith("/")) return null

  const parsed = parse(raw)
  if (!parsed) return null
  if (parsed.protocol !== "https:") return null

  if (parsed.hostname.toLowerCase().endsWith(CLOUDINARY_HOST)) {
    return cloudinaryEmailUrl(raw, request)
  }

  // AniList CDN: natural size, as shipped.
  if (ANILIST_HOST.test(parsed.hostname)) return parsed.toString()

  // Anything else already absolute and https is used unchanged.
  return parsed.toString()
}

/** Poster geometry: AniList covers are 230x326, Cloudinary crops are 3:4. */
export const POSTER = { width: 160, height: 214 } as const
export const HERO = { width: 600, height: 300 } as const
export const HERO_TALL = { width: 600, height: 380 } as const
export const HERO_SQUARE = { width: 600, height: 600 } as const
export const THUMB = { width: 160, height: 106 } as const
export const GRID = { width: 300, height: 180 } as const

export type CropStyle = "wide" | "tall" | "square"

export function heroGeometry(crop: CropStyle) {
  if (crop === "tall") return HERO_TALL
  if (crop === "square") return HERO_SQUARE
  return HERO
}

/** Absolute site URL for a path, safe against double slashes. */
export function siteUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, "")
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  return `${cleanBase}${cleanPath}`
}
