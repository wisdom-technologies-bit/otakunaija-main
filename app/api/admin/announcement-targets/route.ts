import { NextResponse } from "next/server"
import { ADMIN_EMAIL, getCurrentSession } from "@/lib/auth"
import { sql } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Option = { key: string; label: string; hint?: string }

/** Escape LIKE wildcards so a search for "100%" doesn't match everything. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/**
 * Admin-only search used by the announcement editor's page pickers.
 *   ?kind=blog-post&q=...
 *   ?kind=series&q=...
 *   ?kind=episode&q=...
 */
export async function GET(request: Request) {
  const session = await getCurrentSession()
  if (!session || session.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const kind = url.searchParams.get("kind")
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80)
  const pattern = likePattern(q)

  try {
    let options: Option[] = []

    if (kind === "blog-post") {
      const rows = (await sql`
        SELECT slug, title FROM posts
        WHERE ${q} = '' OR title ILIKE ${pattern} OR slug ILIKE ${pattern}
        ORDER BY published_at DESC
        LIMIT 15
      `) as Array<{ slug: string; title: string }>
      options = rows.map((r) => ({ key: `blog-post:${r.slug}`, label: r.title, hint: `/blog/${r.slug}` }))
    } else if (kind === "series") {
      const rows = (await sql`
        SELECT slug, title FROM series
        WHERE ${q} = '' OR title ILIKE ${pattern} OR slug ILIKE ${pattern}
        ORDER BY created_at DESC NULLS LAST
        LIMIT 15
      `) as Array<{ slug: string; title: string }>
      options = rows.flatMap((r) => [
        { key: `series:${r.slug}`, label: r.title, hint: `Series page · /episodes/${r.slug}` },
        { key: `episode-of:${r.slug}`, label: `All episodes of ${r.title}`, hint: `/episodes/${r.slug}/…` },
      ])
    } else if (kind === "episode") {
      const rows = (await sql`
        SELECT s.slug AS series_slug, s.title AS series_title, e.slug AS episode_slug,
               e.title AS episode_title, e.episode_number
        FROM episodes e
        JOIN series s ON s.id = e.series_id
        WHERE ${q} = '' OR e.title ILIKE ${pattern} OR e.slug ILIKE ${pattern} OR s.title ILIKE ${pattern}
        ORDER BY e.published_at DESC
        LIMIT 15
      `) as Array<{
        series_slug: string
        series_title: string
        episode_slug: string
        episode_title: string
        episode_number: number
      }>
      options = rows.map((r) => ({
        key: `episode:${r.series_slug}/${r.episode_slug}`,
        label: `${r.series_title} · Ep ${r.episode_number} — ${r.episode_title}`,
        hint: `/episodes/${r.series_slug}/${r.episode_slug}`,
      }))
    } else {
      return NextResponse.json({ error: "Unknown kind" }, { status: 400 })
    }

    return NextResponse.json({ options })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Search failed" }, { status: 500 })
  }
}
