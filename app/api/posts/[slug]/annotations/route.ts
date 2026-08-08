import { NextRequest, NextResponse } from "next/server"
import { createAnnotation, getAnnotations, getUserFromRequest } from "@/lib/db/queries/comments"

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const annotations = await getAnnotations(params.slug)
    return NextResponse.json({ annotations })
  } catch (error) {
    console.error("Get annotations error:", error)
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

    const { selected_text, context_hash, start_offset, end_offset, comment_body } = await request.json()

    if (!selected_text || context_hash === undefined || start_offset === undefined || end_offset === undefined) {
      return NextResponse.json({ error: "Missing annotation fields" }, { status: 400 })
    }

    const result = await createAnnotation({
      postSlug: params.slug,
      selectedText: selected_text,
      contextHash: context_hash,
      startOffset: start_offset,
      endOffset: end_offset,
      userId: user.id,
      commentBody: comment_body || "",
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Create annotation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}