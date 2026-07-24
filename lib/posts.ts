import { sql } from "./db"

export type Post = {
  id: number
  slug: string
  title: string
  excerpt: string
  content: string
  cover_image: string | null
  category: string
  author: string
  tags: string[] | null
  featured: boolean
  trending: boolean
  views: number
  read_time: number
  published_at: string
  created_at: string
}

export const CATEGORIES = ["Shonen", "Romance", "Action", "Guides"] as const

export function getCoverImage(post: Pick<Post, "cover_image" | "title" | "category">, w = 900, h = 600) {
  if (post.cover_image && post.cover_image.trim().length > 0) {
    return post.cover_image
  }
  return `/placeholder.svg?height=${h}&width=${w}&query=${encodeURIComponent(`anime ${post.category} ${post.title}`)}`
}

export async function getFeaturedPosts(limit = 4): Promise<Post[]> {
  const rows = await sql`
    SELECT * FROM posts
    WHERE featured = true
    ORDER BY published_at DESC
    LIMIT ${limit}
  `
  return rows as Post[]
}

export async function getTrendingPosts(limit = 5): Promise<Post[]> {
  const rows = await sql`
    SELECT * FROM posts
    WHERE trending = true
    ORDER BY views DESC
    LIMIT ${limit}
  `
  return rows as Post[]
}

export async function getRecentPosts(limit = 6, offset = 0): Promise<Post[]> {
  const rows = await sql`
    SELECT * FROM posts
    ORDER BY published_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `
  return rows as Post[]
}

export async function getAllPosts(options?: { category?: string; search?: string }): Promise<Post[]> {
  const { category, search } = options ?? {}

  if (category && search) {
    const like = `%${search}%`
    const rows = await sql`
      SELECT * FROM posts
      WHERE category = ${category}
        AND (title ILIKE ${like} OR excerpt ILIKE ${like})
      ORDER BY published_at DESC
    `
    return rows as Post[]
  }

  if (category) {
    const rows = await sql`
      SELECT * FROM posts
      WHERE category = ${category}
      ORDER BY published_at DESC
    `
    return rows as Post[]
  }

  if (search) {
    const like = `%${search}%`
    const rows = await sql`
      SELECT * FROM posts
      WHERE title ILIKE ${like} OR excerpt ILIKE ${like}
      ORDER BY published_at DESC
    `
    return rows as Post[]
  }

  const rows = await sql`SELECT * FROM posts ORDER BY published_at DESC`
  return rows as Post[]
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const rows = await sql`SELECT * FROM posts WHERE slug = ${slug} LIMIT 1`
  return (rows[0] as Post) ?? null
}

export async function getRelatedPosts(slug: string, category: string, limit = 3): Promise<Post[]> {
  const rows = await sql`
    SELECT * FROM posts
    WHERE category = ${category} AND slug <> ${slug}
    ORDER BY published_at DESC
    LIMIT ${limit}
  `
  return rows as Post[]
}

export async function incrementPostViews(slug: string): Promise<void> {
  await sql`UPDATE posts SET views = views + 1 WHERE slug = ${slug}`
}

export async function getAllSlugs(): Promise<{ slug: string; published_at: string }[]> {
  const rows = await sql`SELECT slug, published_at FROM posts ORDER BY published_at DESC`
  return rows as { slug: string; published_at: string }[]
}

export function formatDate(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const then = new Date(dateString)
  const diffMs = now.getTime() - then.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return `${diffSec}s ago`
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return formatDate(dateString)
}
