import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { series } from '@/lib/db/schema'
import { getTopSeriesByGenre } from '@/lib/db/queries'
import { splitGenres } from '@/lib/genres'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const slugs = new URL(request.url).searchParams.get('slugs')?.split(',').filter((slug) => /^[a-z0-9-]+$/i.test(slug)).filter((slug, i, all) => all.indexOf(slug) === i).slice(0, 5) ?? []
  if (!slugs.length) return NextResponse.json({ series: [] })

  const rows = (await Promise.all(slugs.map((slug) => db.select({ slug: series.slug, id: series.id, title: series.title, genre: series.genre, posterUrl: series.posterUrl, coverImage: series.coverImage }).from(series).where(eq(series.slug, slug)).limit(1)))).flat()
  const ordered = slugs.map((slug) => rows.find((row) => row.slug === slug)).filter((row): row is (typeof rows)[number] => Boolean(row))
  const genres: string[] = []
  for (const row of ordered) for (const genre of splitGenres(row.genre)) if (!genres.some((item) => item.toLowerCase() === genre.toLowerCase())) { genres.push(genre); break }
  if (genres.length < 4) for (const row of ordered) for (const genre of splitGenres(row.genre)) if (!genres.some((item) => item.toLowerCase() === genre.toLowerCase())) { genres.push(genre); if (genres.length === 4) break }
  const watched = new Set(ordered.map((row) => row.slug))
  const picked = new Set<string>()
  const result = []
  for (const genre of genres.slice(0, 4)) {
    let candidates: Awaited<ReturnType<typeof getTopSeriesByGenre>> = []
    try {
      candidates = await getTopSeriesByGenre(genre, 10)
    } catch {
      continue
    }
    const candidate = candidates.find((item) => !watched.has(item.series.slug) && !picked.has(item.series.slug))
    if (candidate) { picked.add(candidate.series.slug); result.push({ slug: candidate.series.slug, title: candidate.series.title, posterUrl: candidate.series.posterUrl ?? candidate.series.coverImage, genre, latestEpisodeNumber: candidate.latestEpisodeNumber }) }
  }
  return NextResponse.json({ series: result })
}
