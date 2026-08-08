import { NextRequest, NextResponse } from "next/server"
import { activatePost } from "@/lib/db/queries/comments"

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    await activatePost(params.slug)
    return NextResponse.json({ active: true })
  } catch (error) {
    console.error("Activation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}