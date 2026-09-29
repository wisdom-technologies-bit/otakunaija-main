import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { series } from '@/lib/db/schema'
import { hasValidPlayApiKey, unauthorizedResponse } from '@/lib/play-auth'

export const maxDuration = 60

let lastAniListCallAt = 0

const TITLE_QUERY = `query ($id: Int) { Media(id: $id, type: ANIME) { title { english romaji } } }`

async function fetchAniListTitle(anilistId: number) {
  const wait = Math.max(0, 700 - (Date.now() - lastAniListCallAt))
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastAniListCallAt = Date.now()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: TITLE_QUERY, variables: { id: anilistId } }),
      signal: controller.signal,
    })

    if (!response.ok) return null
    const json = await response.json()
    return json?.data?.Media?.title ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(request: Request) {
  if (!hasValidPlayApiKey(request)) return unauthorizedResponse()

  const startedAt = Date.now()
  const rows = await db
    .select({ id: series.id, anilistId: series.anilistId, title: series.title })
    .from(series)
    .where(and(eq(series.titleChecked, false), isNotNull(series.anilistId)))
    .orderBy(asc(series.id))
    .limit(15)

  if (rows.length === 0) {
    return Response.json({ rowsSelected: 0, message: 'nothing to check' })
  }

  let updated = 0
  let markedDoneNoChange = 0
  let skipped = 0
  let stoppedByBudget = 0

  for (let i = 0; i < rows.length; i++) {
    if (Date.now() - startedAt >= 50_000) {
      stoppedByBudget = rows.length - i
      break
    }

    const row = rows[i]
    const title = await fetchAniListTitle(row.anilistId as number)
    if (!title) {
      skipped++
      continue
    }

    const englishTitle = typeof title.english === 'string' ? title.english.trim() : ''
    if (englishTitle && englishTitle.toLowerCase() !== row.title.trim().toLowerCase()) {
      await db.update(series).set({ title: englishTitle, titleChecked: true }).where(eq(series.id, row.id))
      updated++
    } else {
      await db.update(series).set({ titleChecked: true }).where(eq(series.id, row.id))
      markedDoneNoChange++
    }
  }

  return Response.json({
    rowsSelected: rows.length,
    updated,
    markedDoneNoChange,
    skipped,
    stoppedByBudget,
  })
}
