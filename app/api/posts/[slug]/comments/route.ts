import { NextRequest, NextResponse } from "next/server"
import { getCommentsByPostSlug, createComment, getUserFromRequest } from "@/lib/db/queries/comments"

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const comments = await getCommentsByPostSlug(params.slug)
    return NextResponse.json({ comments })
  } catch (error) {
    console.error("Get comments error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { body, parent_id } = await request.json()
    if (!body || typeof body !== "string") {
      return NextResponse.json({ error: "Body is required" }, { status: 400 })
    }

    const newComment = await createComment({
      postSlug: params.slug,
      userId: user.id,
      body,
      parentId: parent_id || undefined,
    })

    return NextResponse.json({ comment: newComment })
  } catch (error) {
    console.error("Create comment error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}