/**
 * Hosts we are willing to serve a post cover from *without* copying it into
 * Cloudinary first.
 *
 * ANN sometimes serves its og:image from a CDN that rejects our image copy
 * (403 for hotlinks). When the Cloudinary copy fails we can still use the
 * original URL as `cover_image` — but only for a host we trust, because the
 * cover then lives on someone else's server.
 *
 * Keep this list in sync with `images.remotePatterns` in next.config.mjs;
 * lib/news/image-hosts.test.ts fails if the two drift apart.
 */
export const ALLOWED_COVER_HOSTS = [
  "www.animenewsnetwork.com",
  "cdn.animenewsnetwork.com",
] as const

export type AllowedCoverHost = (typeof ALLOWED_COVER_HOSTS)[number]

/** True when the URL is https and its hostname is on the allow list. */
export function isAllowedCoverHost(url: string | null | undefined): boolean {
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:") return false
  return (ALLOWED_COVER_HOSTS as readonly string[]).includes(parsed.hostname)
}

/**
 * The remote og:image URL, but only when its host is allowed. Returns null so
 * callers can fall back to the generated cover tile.
 */
export function remoteCoverFallback(url: string | null | undefined): string | null {
  return isAllowedCoverHost(url) ? (url as string) : null
}
