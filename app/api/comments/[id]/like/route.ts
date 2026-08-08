import { NextRequest, NextResponse } from "next/server"
import { toggleLike } from "@/lib/db/queries/comments"
import { getUserFromRequest } from "@/lib/auth-utils"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const commentId = parseInt(id)
    if (isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid comment id" }, { status: 400 })
    }

    const result = await toggleLike(commentId, user.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Like error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}