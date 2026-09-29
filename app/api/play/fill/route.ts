
import { eq, or, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { series } from '@/lib/db/schema'
import { hasValidPlayApiKey, unauthorizedResponse } from '@/lib/play-auth'

export const maxDuration = 60

async function fetchAniListImages(anilistId: number) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query ($id: Int) { Media(id: $id, type: ANIME) { coverImage { extraLarge } bannerImage } }`,
      variables: { id: anilistId },
    }),
  })

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 3000))
    return fetchAniListImages(anilistId)
  }

  if (!res.ok) return null
  const json = await res.json()
  return json?.data?.Media ?? null
}

export async function GET(request: Request) {
  if (!hasValidPlayApiKey(request)) return unauthorizedResponse()

  const startedAt = Date.now()
  const BATCH_LIMIT = 15
  const TIME_BUDGET_MS = 50000

  const rows = await db
    .select({
      id: series.id,
      anilistId: series.anilistId,
      posterImageUrl: series.posterImageUrl,
      coverImageUrl: series.coverImageUrl,
    })
    .from(series)
    .where(
      sql`${series.anilistId} IS NOT NULL AND (
        ${isNull(series.posterImageUrl)}
        OR ${isNull(series.coverImageUrl)}
        OR ${series.posterImageUrl} = ${series.coverImageUrl}
      )`
    )
    .limit(BATCH_LIMIT)

  let updated = 0
  let skipped = 0
  let stoppedByBudget = 0

  for (let i = 0; i < rows.length; i++) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      stoppedByBudget = rows.length - i
      break
    }

    const row = rows[i]
    const media = row.anilistId ? await fetchAniListImages(row.anilistId) : null
    await new Promise((r) => setTimeout(r, 700))

    if (!media) {
      skipped++
      continue
    }

    const poster = media.coverImage?.extraLarge ?? row.posterImageUrl ?? null
    const banner = media.bannerImage ?? poster ?? row.coverImageUrl ?? null

    await db
      .update(series)
      .set({ posterImageUrl: poster, coverImageUrl: banner })
      .where(eq(series.id, row.id))

    updated++
  }

  return Response.json({
    rowsSelected: rows.length,
    updated,
    skipped,
    stoppedByBudget,
  })
}
