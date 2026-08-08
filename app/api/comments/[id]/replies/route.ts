import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { comments, commentUsers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const parentId = parseInt(params.id)
  if (isNaN(parentId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      likes: comments.likes,
      createdAt: comments.createdAt,
      user: {
        id: commentUsers.id,
        name: commentUsers.name,
        username: commentUsers.username,
      },
      // We'll not include nested replies further; they can be loaded on demand
    })
    .from(comments)
    .leftJoin(commentUsers, eq(comments.userId, commentUsers.id))
    .where(eq(comments.parentId, parentId))
    .orderBy(comments.createdAt)

  // For each reply, count deeper replies
  const replies = await Promise.all(
    rows.map(async (row) => {
      const [countRow] = await db
        .select({ count: sql`count(*)` })
        .from(comments)
        .where(eq(comments.parentId, row.id))
      return {
        ...row,
        userLiked: false,
        reactions: {},
        replies: [],
        repliesCount: Number(countRow?.count || 0),
      }
    })
  )

  return NextResponse.json({ replies })
}