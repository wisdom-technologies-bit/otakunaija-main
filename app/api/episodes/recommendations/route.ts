import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { series } from '@/lib/db/schema'
import { getTopSeriesByGenre } from '@/lib/db/queries'
import { splitGenres } from '@/lib/genres'
import { inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get('slugs') ?? ''
    const slugs = Array.from(
      new Set(raw.split(',').map((s) => s.trim()).filter((s) => /^[a-z0-9-]+$/i.test(s)))
    ).slice(0, 5)
    if (!slugs.length) return NextResponse.json({ series: [] })

    const rows = await db
      .select({ slug: series.slug, genre: series.genre })
      .from(series)
      .where(inArray(series.slug, slugs))

    const ordered = slugs
      .map((slug) => rows.find((r) => r.slug === slug))
      .filter((r): r is (typeof rows)[number] => Boolean(r))

    const genres: string[] = []
    const has = (g: string) => genres.some((x) => x.toLowerCase() === g.toLowerCase())

    for (const row of ordered) {
      const first = splitGenres(row.genre).find((g) => !has(g))
      if (first) genres.push(first)
    }
    for (const row of ordered) {
      for (const g of splitGenres(row.genre)) {
        if (genres.length >= 4) break
        if (!has(g)) genres.push(g)
      }
    }

    const watched = new Set(slugs)
    const picked = new Set<string>()
    const result: {
      slug: string
      title: string
      posterUrl: string | null
      genre: string
      latestEpisodeNumber: number | null
    }[] = []

    for (const genre of genres.slice(0, 4)) {
      try {
        const candidates = await getTopSeriesByGenre(genre, 10)
        const pick = candidates.find(
          (c) => !watched.has(c.series.slug) && !picked.has(c.series.slug)
        )
        if (pick) {
          picked.add(pick.series.slug)
          result.push({
            slug: pick.series.slug,
            title: pick.series.title,
            posterUrl: pick.series.posterImageUrl ?? pick.series.coverImageUrl ?? null,
            genre,
            latestEpisodeNumber: pick.latestEpisodeNumber,
          })
        }
      } catch (error) {
        console.error(`[recommendations] genre ${genre} failed`, error)
      }
    }

    return NextResponse.json({ series: result })
  } catch (error) {
    console.error('[recommendations] failed', error)
    return NextResponse.json({ series: [] }, { status: 500 })
  }
}
