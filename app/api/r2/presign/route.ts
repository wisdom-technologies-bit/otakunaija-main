import { NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getCurrentSession } from "@/lib/auth"
import { getR2Client } from "@/lib/r2"

export const runtime = "nodejs"

/**
 * Generate a presigned PUT URL for direct R2 upload.
 *
 * This route:
 * - Checks authentication via session
 * - Accepts fileName and fileType in the request body
 * - Generates a unique object key for the file
 * - Creates a presigned PUT URL valid for 10 minutes
 * - Returns the presigned URL, object key, and final public URL
 *
 * The actual video file is then uploaded directly from the browser to R2
 * using the presigned URL, avoiding Vercel's request limits.
 */
export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await getCurrentSession()

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized - No valid session" },
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    // Parse request body
    let body: { fileName?: string; fileType?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid request body. Expected JSON with fileName and fileType." },
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const { fileName, fileType } = body

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: "Missing fileName or fileType in request body" },
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const bucketName = process.env.R2_BUCKET_NAME
    const publicUrl = process.env.R2_PUBLIC_URL

    if (!bucketName || !publicUrl) {
      return NextResponse.json(
        { error: "R2 bucket or public URL not configured" },
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // Generate unique object key
    const timestamp = Date.now()
    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .toLowerCase()
      .slice(0, 100)
    const objectKey = `episodes/${timestamp}-${sanitizedFileName}`

    // Get R2 client
    const s3Client = getR2Client()

    // Create PUT command
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: fileType,
    })

    // Generate presigned URL (10 minutes = 600 seconds)
    const presignedUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 600 })

    // Build final public URL
    const finalPublicUrl = `${publicUrl}/${objectKey}`

    return NextResponse.json(
      {
        presignedUrl,
        objectKey,
        publicUrl: finalPublicUrl,
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
    console.error("[v0] R2 presign error:", errorMsg)
    return NextResponse.json(
      { error: "Failed to generate presigned URL: " + errorMsg },
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
