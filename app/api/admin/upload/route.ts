import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { isCloudinaryConfigured, uploadImageBuffer } from "@/lib/cloudinary"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      {
        error:
          "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your environment variables.",
      },
      { status: 503 },
    )
  }

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    const url = await uploadImageBuffer(buffer)
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
