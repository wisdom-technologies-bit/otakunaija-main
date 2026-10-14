import { sql } from '@/lib/db'
import { hasValidPlayApiKey, unauthorizedResponse } from '@/lib/play-auth'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT
  return Math.min(parsed, MAX_LIMIT)
}

function parseOptionalInteger(value: string | null) {
  if (value === null || value.trim() === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export async function GET(request: Request) {
  if (!hasValidPlayApiKey(request)) return unauthorizedResponse()

  const url = new URL(request.url)
  const limit = parseLimit(url.searchParams.get('limit'))
  const cursor = parseOptionalInteger(url.searchParams.get('cursor'))
  const ids = url.searchParams
    .get('anilist_ids')
    ?.split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isSafeInteger(value)) ?? null

  const rows = await sql`
    SELECT
      s.id AS series_id,
      s.anilist_id,
      s.title,
      s.status,
      COALESCE(
        array_agg(DISTINCT e.episode_number ORDER BY e.episode_number)
          FILTER (WHERE e.episode_number IS NOT NULL),
        ARRAY[]::integer[]
      ) AS episode_numbers
    FROM series AS s
    LEFT JOIN episodes AS e ON e.series_id = s.id
    WHERE s.status = 'ongoing'
      AND s.anilist_id IS NOT NULL
      AND (${cursor === null} OR s.anilist_id > ${cursor})
      AND (${ids === null} OR s.anilist_id = ANY(${ids}))
    GROUP BY s.id, s.anilist_id, s.title, s.status
    ORDER BY s.anilist_id ASC
    LIMIT ${limit + 1}
  `

  const hasNextPage = rows.length > limit
  const page = hasNextPage ? rows.slice(0, limit) : rows
  const items = page.map((row) => {
    const episodeNumbers = Array.isArray(row.episode_numbers)
      ? row.episode_numbers.map(Number)
      : []

    return {
      series_id: Number(row.series_id),
      anilist_id: Number(row.anilist_id),
      title: row.title,
      status: row.status,
      episode_numbers: episodeNumbers,
      latest_episode: episodeNumbers.length > 0 ? episodeNumbers[episodeNumbers.length - 1] : null,
      episode_count: episodeNumbers.length,
    }
  })

  return Response.json({
    count: items.length,
    next_cursor: hasNextPage && items.length > 0 ? items[items.length - 1].anilist_id : null,
    items,
  })
}
