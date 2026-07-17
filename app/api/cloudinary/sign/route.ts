import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { getCloudinary } from "@/lib/cloudinary"

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
    const session = await getCurrentSession()
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized - No valid session" },
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary not configured. Contact support." },
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get Cloudinary instance which is configured with credentials
    const cloudinary = getCloudinary()

    const timestamp = Math.floor(Date.now() / 1000)

    // Use Cloudinary's official method to generate the signature
    // This ensures compatibility with Cloudinary's expectations
    const params = {
      timestamp,
      folder: "otakunaija/episodes",
    }

    // Use Cloudinary's built-in api_sign_request method which handles the signature calculation correctly
    const signature = cloudinary.utils.api_sign_request(params, apiSecret)

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
    return NextResponse.json(
      { error: "Failed to generate signature: " + errorMsg },
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
