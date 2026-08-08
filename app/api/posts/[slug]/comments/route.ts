import { NextRequest, NextResponse } from "next/server"
import { getCommentsByPostSlug, createComment } from "@/lib/db/queries/comments"
import { getUserFromRequest } from "@/lib/auth-utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const comments = await getCommentsByPostSlug(slug)
    return NextResponse.json({ comments })
  } catch (error) {
    console.error("Get comments error:", error)
    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { body, parent_id } = await request.json()
    if (!body || typeof body !== "string") {
      return NextResponse.json({ error: "Body is required" }, { status: 400 })
    }

    const newComment = await createComment({
      postSlug: slug,
      userId: user.id,
      body,
      parentId: parent_id || undefined,
    })

    return NextResponse.json({ comment: newComment })
  } catch (error) {
    console.error("Create comment error:", error)
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    )
  }
}