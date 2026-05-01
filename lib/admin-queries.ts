import { sql } from "./db"
import type { Post } from "./posts"

export type AdminStats = {
  totalPosts: number
  totalViews: number
  totalSubscribers: number
  totalMessages: number
}

export async function getAdminStats(): Promise<AdminStats> {
  const [postsRow] = (await sql`SELECT COUNT(*)::int AS c, COALESCE(SUM(views),0)::int AS v FROM posts`) as {
    c: number
    v: number
  }[]
  const [subsRow] = (await sql`SELECT COUNT(*)::int AS c FROM subscribers`) as { c: number }[]
  const [msgRow] = (await sql`SELECT COUNT(*)::int AS c FROM contact_messages`) as { c: number }[]
  return {
    totalPosts: postsRow?.c ?? 0,
    totalViews: postsRow?.v ?? 0,
    totalSubscribers: subsRow?.c ?? 0,
    totalMessages: msgRow?.c ?? 0,
  }
}

export async function getAdminPosts(): Promise<Post[]> {
  const rows = await sql`SELECT * FROM posts ORDER BY published_at DESC`
  return rows as Post[]
}

export async function getAdminPostById(id: number): Promise<Post | null> {
  const rows = await sql`SELECT * FROM posts WHERE id = ${id} LIMIT 1`
  return (rows[0] as Post) ?? null
}

export type Subscriber = { id: number; email: string; subscribed_at: string }
export async function getAllSubscribers(): Promise<Subscriber[]> {
  const rows = await sql`SELECT * FROM subscribers ORDER BY subscribed_at DESC`
  return rows as Subscriber[]
}

export type ContactMessage = {
  id: number
  name: string
  email: string
  subject: string | null
  message: string
  created_at: string
}
export async function getAllMessages(): Promise<ContactMessage[]> {
  const rows = await sql`SELECT * FROM contact_messages ORDER BY created_at DESC`
  return rows as ContactMessage[]
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200)
}

export async function ensureUniqueSlug(base: string, excludeId?: number): Promise<string> {
  let slug = slugify(base) || `post-${Date.now()}`
  let n = 1
  while (true) {
    const rows = (excludeId
      ? await sql`SELECT id FROM posts WHERE slug = ${slug} AND id <> ${excludeId} LIMIT 1`
      : await sql`SELECT id FROM posts WHERE slug = ${slug} LIMIT 1`) as { id: number }[]
    if (rows.length === 0) return slug
    n += 1
    slug = `${slugify(base)}-${n}`
  }
}

export type CreatePostInput = {
  title: string
  excerpt: string
  content: string
  category: string
  cover_image?: string | null
  author?: string
  tags?: string[]
  featured?: boolean
  trending?: boolean
  read_time?: number
  slug?: string
}

export async function createPost(input: CreatePostInput): Promise<Post> {
  const slug = await ensureUniqueSlug(input.slug || input.title)
  const tags = input.tags ?? []
  const rows = await sql`
    INSERT INTO posts (slug, title, excerpt, content, cover_image, category, author, tags, featured, trending, read_time)
    VALUES (
      ${slug},
      ${input.title},
      ${input.excerpt},
      ${input.content},
      ${input.cover_image ?? null},
      ${input.category},
      ${input.author ?? "OtakuNaija Team"},
      ${tags},
      ${input.featured ?? false},
      ${input.trending ?? false},
      ${input.read_time ?? 5}
    )
    RETURNING *
  `
  return rows[0] as Post
}

export type UpdatePostInput = CreatePostInput & { id: number }

export async function updatePost(input: UpdatePostInput): Promise<Post> {
  const slug = input.slug ? await ensureUniqueSlug(input.slug, input.id) : undefined
  const tags = input.tags ?? []
  const rows = slug
    ? await sql`
        UPDATE posts SET
          slug = ${slug},
          title = ${input.title},
          excerpt = ${input.excerpt},
          content = ${input.content},
          cover_image = ${input.cover_image ?? null},
          category = ${input.category},
          author = ${input.author ?? "OtakuNaija Team"},
          tags = ${tags},
          featured = ${input.featured ?? false},
          trending = ${input.trending ?? false},
          read_time = ${input.read_time ?? 5}
        WHERE id = ${input.id}
        RETURNING *
      `
    : await sql`
        UPDATE posts SET
          title = ${input.title},
          excerpt = ${input.excerpt},
          content = ${input.content},
          cover_image = ${input.cover_image ?? null},
          category = ${input.category},
          author = ${input.author ?? "OtakuNaija Team"},
          tags = ${tags},
          featured = ${input.featured ?? false},
          trending = ${input.trending ?? false},
          read_time = ${input.read_time ?? 5}
        WHERE id = ${input.id}
        RETURNING *
      `
  return rows[0] as Post
}

export async function deletePost(id: number): Promise<void> {
  await sql`DELETE FROM posts WHERE id = ${id}`
}
