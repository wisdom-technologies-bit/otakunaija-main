import { isCloudinaryConfigured, uploadImageBuffer } from "@/lib/cloudinary"
import { normalizeUrl, USER_AGENT } from "./ann"

const IMAGE_TIMEOUT_MS = 15_000
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const NEWS_IMAGE_FOLDER = "otakunaija/news"

/**
 * ANN (and most news CDNs) reject hotlinked requests that arrive without a
 * Referer, so the copy carries the article's own origin.
 */
export const IMAGE_REFERER = "https://www.animenewsnetwork.com/"
const IMAGE_ACCEPT = "image/avif,image/webp,image/apng,image/*;q=0.9,*/*;q=0.8"

/**
 * Why a cover could not be copied. Stored verbatim in `news_ingest.last_error`
 * (and counted in the cron JSON as `image_reasons`) so an operator can tell a
 * missing Cloudinary key from a blocked image.
 */
export type ImageErrorReason =
  | "no_image"
  | "image_invalid_url"
  | "cloudinary_not_configured"
  | "image_fetch_failed"
  | "image_not_image"
  | "image_empty"
  | "image_too_large"
  | "cloudinary_upload_failed"
  | `image_http_${number}`

export type CopyImageResult = { url: string } | { error: string }

export function isRetryableImageStatus(status: number): boolean {
  return status >= 500 && status <= 599
}

/** Any shape older call sites may pass; normalised by the publisher. */
export type CopyImageLike = CopyImageResult | string | null | undefined

export function normalizeCopyResult(result: CopyImageLike): CopyImageResult {
  if (!result) return { error: "no_image" }
  if (typeof result === "string") return { url: result }
  return result
}

async function requestImage(url: string): Promise<Response | { error: ImageErrorReason }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: IMAGE_ACCEPT,
          Referer: IMAGE_REFERER,
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      })

      if (isRetryableImageStatus(response.status) && attempt === 0) continue
      return response
    } catch {
      if (attempt === 1) return { error: "image_fetch_failed" }
    }
  }
  return { error: "image_fetch_failed" }
}

/**
 * Copies the source article image into Cloudinary so published posts never
 * hotlink ANN's CDN. Never throws: the reason is returned so the caller can
 * record it and decide whether a remote fallback is allowed.
 */
export async function copyImageToCloudinary(imageUrl: string | null): Promise<CopyImageResult> {
  if (!imageUrl) return { error: "no_image" }

  const url = normalizeUrl(imageUrl)
  if (!url) return { error: "image_invalid_url" }

  if (!isCloudinaryConfigured()) return { error: "cloudinary_not_configured" }

  const response = await requestImage(url)
  if (!("ok" in response)) return response

  if (!response.ok) return { error: `image_http_${response.status}` }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase()
  if (contentType && !contentType.startsWith("image/")) return { error: "image_not_image" }

  let buffer: Buffer
  try {
    buffer = Buffer.from(await response.arrayBuffer())
  } catch {
    return { error: "image_fetch_failed" }
  }
  if (!buffer.byteLength) return { error: "image_empty" }
  if (buffer.byteLength > MAX_IMAGE_BYTES) return { error: "image_too_large" }

  try {
    const uploaded = await uploadImageBuffer(buffer, NEWS_IMAGE_FOLDER)
    return { url: uploaded.url }
  } catch {
    return { error: "cloudinary_upload_failed" }
  }
}
