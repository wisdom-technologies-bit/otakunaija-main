import { NextRequest, NextResponse } from "next/server"
import { activatePost } from "@/lib/db/queries/comments"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    if (!slug) {
      return NextResponse.json(
        { error: "Post slug is required" },
        { status: 400 }
      )
    }

    await activatePost(slug)

    return NextResponse.json({ active: true })
  } catch (error) {
    console.error("Activation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}