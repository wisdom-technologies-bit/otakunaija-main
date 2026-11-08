import { isCloudinaryConfigured, uploadImageBuffer } from "@/lib/cloudinary"
import { normalizeUrl, USER_AGENT } from "./ann"

const IMAGE_TIMEOUT_MS = 15_000
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const NEWS_IMAGE_FOLDER = "otakunaija/news"

/**
 * Copies the source article image into Cloudinary so published posts never
 * hotlink ANN's CDN. Returns null when there is nothing to copy (or Cloudinary
 * is not configured), so the post falls back to the site placeholder.
 */
export async function copyImageToCloudinary(imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null
  if (!isCloudinaryConfigured()) return null

  const url = normalizeUrl(imageUrl)
  if (!url) return null

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
    cache: "no-store",
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`image_http_${response.status}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.byteLength) throw new Error("image_empty")
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("image_too_large")

  const uploaded = await uploadImageBuffer(buffer, NEWS_IMAGE_FOLDER)
  return uploaded.url
}
