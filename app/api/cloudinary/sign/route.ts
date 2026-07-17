import { createHmac } from "crypto"
import { NextResponse } from "next/server"

/**
 * Generate a signed upload signature for Cloudinary.
 *
 * This route ONLY generates and returns a signature + timestamp. It does NOT:
 * - Receive the video file itself
 * - Store the video file
 * - Upload anything to Cloudinary
 *
 * The actual video bytes are sent directly from the browser to Cloudinary using
 * this signature, avoiding Vercel's request body size limits and execution timeouts
 * that would occur if video files were routed through this serverless function.
 *
 * Security: The Cloudinary API secret is stored server-side and never exposed to
 * the browser, so only authenticated requests from our server can generate valid signatures.
 */
export async function POST() {
  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
      console.error("[v0] Missing Cloudinary env vars")
      return NextResponse.json(
        { error: "Cloudinary not configured" },
        { status: 500 }
      )
    }

    const timestamp = Math.floor(Date.now() / 1000)

    // Build the string to sign
    const paramsToSign = {
      timestamp,
      folder: "otakunaija/episodes",
      resource_type: "video",
    }

    // Convert to string format: "key1=value1&key2=value2&...&api_secret"
    const sortedParams = Object.entries(paramsToSign)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&")

    const stringToSign = `${sortedParams}${apiSecret}`

    // Generate HMAC SHA-1 signature
    const signature = createHmac("sha1", apiSecret)
      .update(stringToSign)
      .digest("hex")

    return NextResponse.json(
      {
        signature,
        timestamp,
        api_key: apiKey,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (error) {
    console.error("[v0] Cloudinary sign error:", error)
    return NextResponse.json(
      { error: "Failed to generate signature" },
      { status: 500 }
    )
  }
}
