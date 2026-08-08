import { db } from "@/lib/db/index"
import { sql as neonSql } from "@/lib/db"
import {
  commentUsers,
  comments,
  textAnnotations,
  reactions,
  commentLikes,
  activatedPosts,
} from "@/lib/db/schema"
import { eq, and, sql, count, desc } from "drizzle-orm"
import { generateToken, generateUsername } from "@/lib/auth-utils"  // we'll move generateUsername here

// ---------- Auth ----------
export async function registerOrLogin(email: string, name?: string) {
  // check existing
  const [existing] = await db
    .select()
    .from(commentUsers)
    .where(eq(commentUsers.email, email))
    .limit(1)

  if (existing) {
    return { token: existing.token, username: existing.username }
  }

  const token = generateToken()
  const username = await generateUniqueUsername(name || email.split("@")[0])

  const [newUser] = await db
    .insert(commentUsers)
    .values({
      email,
      name: name || null,
      username,
      token,
    })
    .returning()

  return { token: newUser.token, username: newUser.username }
}

async function generateUniqueUsername(base: string): Promise<string> {
  const sanitized = base.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase().slice(0, 15)
  let username = sanitized || "user"
  let exists = true
  while (exists) {
    const [row] = await db
      .select()
      .from(commentUsers)
      .where(eq(commentUsers.username, username))
      .limit(1)
    if (!row) {
      exists = false
    } else {
      username = `${sanitized}_${Math.random().toString(36).substring(2, 6)}`
    }
  }
  return username
}

// ---------- Post activation ----------
export async function activatePost(slug: string) {
  if (!slug || typeof slug !== "string") {
    throw new Error("A valid post slug is required to activate a post")
  }

  await neonSql`
    INSERT INTO activated_posts (slug)
    VALUES (${slug})
    ON CONFLICT (slug) DO NOTHING
  `
}

// ---------- Comments ----------
export async function getCommentsTree(postSlug: string) {
  // Fetch top-level comments with user info, like status, reaction counts
  const topComments = await db
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
    })
    .from(comments)
    .leftJoin(commentUsers, eq(comments.userId, commentUsers.id))
    .where(and(eq(comments.postSlug, postSlug), eq(comments.parentId, null)))
    .orderBy(desc(comments.createdAt))

  // For each comment, get its immediate replies (depth 1) with deeper count
  const result = await Promise.all(
    topComments.map(async (c) => {
      const [likedByUser] = await db
        .select()
        .from(commentLikes)
        .where(eq(commentLikes.commentId, c.id))
        .limit(1) // will be filled with user-specific data later? Not yet; we'll pass userId to the endpoint

      // reactions summary
      const reactionRows = await db
        .select({
          type: reactions.type,
          count: count(),
        })
        .from(reactions)
        .where(eq(reactions.commentId, c.id))
        .groupBy(reactions.type)

      const reactionMap: Record<string, number> = {}
      reactionRows.forEach(r => reactionMap[r.type] = r.count)

      // replies (first 2 levels)
      const replies = await getReplies(c.id, 0, 2)

      return {
        ...c,
        userLiked: false, // we'll set it later based on current user
        reactions: reactionMap,
        replies,
        repliesCount: 0, // will be set after calculating deeper count
      }
    })
  )
  return result
}

async function getReplies(parentId: number, currentDepth: number, maxDepth: number): Promise<any[]> {
  if (currentDepth >= maxDepth) return [] // depth limited in this simplified version; we'll handle 'load more' later

  const repliesData = await db
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
    })
    .from(comments)
    .leftJoin(commentUsers, eq(comments.userId, commentUsers.id))
    .where(eq(comments.parentId, parentId))
    .orderBy(comments.createdAt)

  // For each reply, get nested replies recursively (but we cut off at maxDepth)
  const replies = await Promise.all(
    repliesData.map(async (r) => {
      const nested = await getReplies(r.id, currentDepth + 1, maxDepth)
      // deeper count
      const [countResult] = await db
        .select({ cnt: count() })
        .from(comments)
        .where(eq(comments.parentId, r.id))

      return {
        ...r,
        userLiked: false,
        reactions: {},
        replies: nested,
        repliesCount: countResult?.cnt || 0,
      }
    })
  )
  return replies
}

export async function createComment(data: {
  postSlug: string
  userId: number
  body: string
  parentId?: number | null
}) {
  const rows = await neonSql`
    INSERT INTO comments (post_slug, parent_id, user_id, body)
    VALUES (${data.postSlug}, ${data.parentId ?? null}, ${data.userId}, ${data.body})
    RETURNING id, post_slug, parent_id, user_id, body, likes, created_at
  `

  const row = rows[0]

  return {
    id: row.id,
    postSlug: row.post_slug,
    parentId: row.parent_id,
    userId: row.user_id,
    body: row.body,
    likes: row.likes,
    createdAt: row.created_at,
  }
}

// ---------- Annotations ----------
export async function createAnnotation(data: {
  postSlug: string
  selectedText: string
  contextHash: string
  startOffset: number
  endOffset: number
  userId: number
  commentBody?: string
}) {
  // Create comment first
  const comment = await createComment({
    postSlug: data.postSlug,
    userId: data.userId,
    body: data.commentBody || "",
  })

  const [annotation] = await db
    .insert(textAnnotations)
    .values({
      postSlug: data.postSlug,
      selectedText: data.selectedText,
      contextHash: data.contextHash,
      startOffset: data.startOffset,
      endOffset: data.endOffset,
      commentId: comment.id,
    })
    .returning()

  return { annotation, comment }
}

export async function getAnnotations(postSlug: string) {
  const rows = await db
    .select({
      annotation: textAnnotations,
      comment: comments,
      user: commentUsers,
    })
    .from(textAnnotations)
    .leftJoin(comments, eq(textAnnotations.commentId, comments.id))
    .leftJoin(commentUsers, eq(comments.userId, commentUsers.id))
    .where(eq(textAnnotations.postSlug, postSlug))

  return rows
}

// ---------- Likes & Reactions ----------
export async function toggleLike(commentId: number, userId: number) {
  const existing = await db
    .select()
    .from(commentLikes)
    .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)))
    .limit(1)

  if (existing.length) {
    await db
      .delete(commentLikes)
      .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)))
    await db
      .update(comments)
      .set({ likes: sql`${comments.likes} - 1` })
      .where(eq(comments.id, commentId))
    return { liked: false, likes: await getLikesCount(commentId) }
  } else {
    await db
      .insert(commentLikes)
      .values({ commentId, userId })
    await db
      .update(comments)
      .set({ likes: sql`${comments.likes} + 1` })
      .where(eq(comments.id, commentId))
    return { liked: true, likes: await getLikesCount(commentId) }
  }
}

export async function toggleReaction(commentId: number, userId: number, type: string) {
  const existing = await db
    .select()
    .from(reactions)
    .where(
      and(
        eq(reactions.commentId, commentId),
        eq(reactions.userId, userId),
        eq(reactions.type, type)
      )
    )
    .limit(1)

  if (existing.length) {
    await db
      .delete(reactions)
      .where(
        and(
          eq(reactions.commentId, commentId),
          eq(reactions.userId, userId),
          eq(reactions.type, type)
        )
      )
  } else {
    await db
      .insert(reactions)
      .values({ commentId, userId, type })
  }

  return getReactionCounts(commentId)
}

async function getLikesCount(commentId: number) {
  const [row] = await db
    .select({ likes: comments.likes })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1)
  return row?.likes ?? 0
}

async function getReactionCounts(commentId: number) {
  const rows = await db
    .select({ type: reactions.type, cnt: count() })
    .from(reactions)
    .where(eq(reactions.commentId, commentId))
    .groupBy(reactions.type)
  const map: Record<string, number> = {}
  rows.forEach(r => map[r.type] = r.cnt)
  return map
}

export async function getCommentsByPostSlug(postSlug: string) {
  return getCommentsTree(postSlug)
}