import { createHmac } from "crypto"
import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"

export const runtime = "nodejs"

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
export async function POST(request: Request) {
  try {
    // Verify user is authenticated before generating signature
    console.log("[v0] Cloudinary sign endpoint called")
    
    const session = await getCurrentSession()
    console.log("[v0] Session validation result:", session ? `Valid - ${session.email}` : "No session")
    
    if (!session) {
      console.error("[v0] Unauthorized: No valid session found. Session authentication failed.")
      return NextResponse.json(
        { error: "Unauthorized - No valid session" },
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
      console.error("[v0] Missing Cloudinary env vars:", {
        cloudName: !!cloudName,
        apiKey: !!apiKey,
        apiSecret: !!apiSecret,
      })
      return NextResponse.json(
        { error: "Cloudinary not configured. Contact support." },
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
    
    console.log("[v0] Cloudinary configured. Generating signature...")  

    const timestamp = Math.floor(Date.now() / 1000)

    // Build the string to sign
    const paramsToSign = {
      timestamp,
      folder: "otakunaija/episodes",
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
        cloud_name: cloudName,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("[v0] Cloudinary sign error:", errorMsg, error)
    return NextResponse.json(
      { error: "Failed to generate signature: " + errorMsg },
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
