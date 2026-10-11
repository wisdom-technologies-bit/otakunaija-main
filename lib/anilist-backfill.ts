
import { db } from "@/lib/db/index"
import { sql } from "drizzle-orm"

const QUERY = `query ($search: String) { Media(search: $search, type: ANIME) { id title { romaji english } } }`
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
export function slugify(input: string) { return input.toLowerCase().trim().replace(/[\'\"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200) }
async function find(title: string) {
  const request = () => fetch("https://graphql.anilist.co", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: QUERY, variables: { search: title } }), signal: AbortSignal.timeout(10_000) })
  let response = await request(); if (response.status === 429) { await wait(3000); response = await request() }
  if (!response.ok) return null
  const body = await response.json() as { data?: { Media?: { id: number; title?: { english?: string; romaji?: string } } } }
  return body.data?.Media ?? null
}
export type BackfillSummary = { seriesChecked: number; autoApplied: number; flaggedForReview: number; skipped: number }
export async function runAniListBackfill(): Promise<BackfillSummary> {
  const rows = await sql`SELECT id, title, slug FROM series WHERE anilist_id IS NULL ORDER BY id ASC LIMIT 20`
  const all = await sql`SELECT id, title, slug, anilist_id AS "anilistId" FROM series`
  const out = { seriesChecked: 0, autoApplied: 0, flaggedForReview: 0, skipped: 0 }
  for (const item of rows as Array<{ id: number; title: string; slug: string }>) {
    if (out.seriesChecked) await wait(700); out.seriesChecked++
    let media: Awaited<ReturnType<typeof find>> = null; try { media = await find(item.title) } catch { media = null }
    if (!media) { out.skipped++; continue }
    const exact = (all as Array<{ id: number; title: string; slug: string; anilistId: number | null }>).find((x) => x.id !== item.id && x.anilistId === media!.id)
    const soft = exact ? undefined : (all as Array<{ id: number; title: string; slug: string; anilistId: number | null }>).find((x) => x.id !== item.id && (slugify(x.title) === slugify(item.title) || slugify(x.slug) === slugify(item.title)))
    const conflict = exact || soft; const candidateTitle = media.title?.english || media.title?.romaji || item.title
    if (!conflict) { await sql`UPDATE series SET anilist_id = ${media.id} WHERE id = ${item.id} AND anilist_id IS NULL`; out.autoApplied++; continue }
    await sql`INSERT INTO anime_match_candidates (series_id, candidate_anilist_id, candidate_title, conflict_series_id, conflict_reason, status) VALUES (${item.id}, ${media.id}, ${candidateTitle}, ${conflict.id}, ${exact ? "exact anilistId collision" : "near-identical title/slug"}, 'pending') ON CONFLICT (series_id) DO UPDATE SET candidate_anilist_id = EXCLUDED.candidate_anilist_id, candidate_title = EXCLUDED.candidate_title, conflict_series_id = EXCLUDED.conflict_series_id, conflict_reason = EXCLUDED.conflict_reason, status = 'pending'`
    out.flaggedForReview++
  } return out
}

export async function getPendingAniListMatches() {
  const result = await db.execute(sql`
    SELECT
      c.id,
      c.candidate_anilist_id AS "candidateAnilistId",
      c.candidate_title AS "candidateTitle",
      c.conflict_reason AS "conflictReason",
      json_build_object(
        'id', s.id,
        'title', s.title,
        'slug', s.slug,
        'anilistId', s.anilist_id,
        'coverImageUrl', s.cover_image_url,
        'posterImageUrl', s.poster_image_url
      ) AS series,
      CASE
        WHEN o.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', o.id,
          'title', o.title,
          'slug', o.slug,
          'anilistId', o.anilist_id,
          'coverImageUrl', o.cover_image_url,
          'posterImageUrl', o.poster_image_url
        )
      END AS "conflictSeries"
    FROM anime_match_candidates c
    JOIN series s ON s.id = c.series_id
    LEFT JOIN series o ON o.id = c.conflict_series_id
    WHERE c.status = 'pending'
    ORDER BY c.id ASC
  `)

  return result.rows
}



export async function mergeAniListMatch(
  id: number,
  keep: number,
  discard: number
) {
  return db.transaction(async (tx) => {
    const candidateResult = await tx.execute(sql`
      SELECT series_id, conflict_series_id, candidate_anilist_id
      FROM anime_match_candidates
      WHERE id = ${id} AND status = 'pending'
      FOR UPDATE
    `)

    const [candidate] = candidateResult.rows as Array<{
      series_id: number
      conflict_series_id: number | null
      candidate_anilist_id: number
    }>

    if (!candidate) return null

    if (
      !(
        (candidate.series_id === keep &&
          candidate.conflict_series_id === discard) ||
        (candidate.series_id === discard &&
          candidate.conflict_series_id === keep)
      )
    ) {
      return "invalid-pair" as const
    }

    const keptResult = await tx.execute(sql`
      SELECT id
      FROM series
      WHERE id = ${keep}
      FOR UPDATE
    `)

    const goneResult = await tx.execute(sql`
      SELECT id
      FROM series
      WHERE id = ${discard}
      FOR UPDATE
    `)

    const [kept] = keptResult.rows
    const [gone] = goneResult.rows

    if (!kept || !gone) return "invalid-pair" as const

    await tx.execute(sql`
      UPDATE episodes
      SET series_id = ${keep}
      WHERE series_id = ${discard}
    `)

    await tx.execute(sql`
  DELETE FROM series
  WHERE id = ${discard}
`)

await tx.execute(sql`
  UPDATE series
  SET anilist_id = ${candidate.candidate_anilist_id}
  WHERE id = ${keep} AND anilist_id IS NULL
`)

    await tx.execute(sql`
      UPDATE anime_match_candidates
      SET status = 'resolved'
      WHERE id = ${id} AND status = 'pending'
    `)

    return { merged: true, keptSeriesId: keep }
  })
}
export async function rejectAniListMatch(id: number) { const result = await sql`UPDATE anime_match_candidates SET status = 'rejected' WHERE id = ${id} AND status = 'pending' RETURNING id`; return result.length > 0 }
