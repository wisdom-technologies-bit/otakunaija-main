import { NextRequest, NextResponse } from "next/server"
import { toggleReaction, getUserFromRequest } from "@/lib/db/queries/comments"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const commentId = parseInt(params.id)
    if (isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid comment id" }, { status: 400 })
    }

    const { type } = await request.json()
    if (!type || !["like","love","laugh","wow"].includes(type)) {
      return NextResponse.json({ error: "Invalid reaction type" }, { status: 400 })
    }

    const counts = await toggleReaction(commentId, user.id, type)
    return NextResponse.json({ reactions: counts })
  } catch (error) {
    console.error("React error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}