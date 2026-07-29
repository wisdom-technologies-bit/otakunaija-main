import { NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getCurrentSession } from "@/lib/auth"
import { getR2Client } from "@/lib/r2"

export const runtime = "nodejs"

/**
 * Generate a presigned PUT URL for subtitle file upload to R2.
 *
 * This route:
 * - Checks authentication via session
 * - Validates subtitle file format (.srt, .vtt)
 * - Generates a unique object key in the subtitles/ directory
 * - Creates a presigned PUT URL valid for 10 minutes
 * - Returns the presigned URL, object key, and final public URL
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

    // Validate subtitle file type
    const validSubtitleTypes = ["text/plain", "text/vtt", "application/x-subrip"]
    const validExtensions = [".srt", ".vtt"]
    const ext = fileName.toLowerCase().slice(-4)

    if (!validExtensions.includes(ext) || !validSubtitleTypes.includes(fileType)) {
      return NextResponse.json(
        { error: "Invalid subtitle file format. Please upload .srt or .vtt files." },
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

    // Generate unique object key in subtitles directory
    const timestamp = Date.now()
    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .toLowerCase()
      .slice(0, 100)
    const objectKey = `subtitles/${timestamp}-${sanitizedFileName}`

    // Get R2 client
    const s3Client = getR2Client()

    // Create PUT command with text/vtt content type for playback
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: "text/vtt",
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
    console.error("[v0] R2 subtitle upload error:", errorMsg)
    return NextResponse.json(
      { error: "Failed to generate presigned URL: " + errorMsg },
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
