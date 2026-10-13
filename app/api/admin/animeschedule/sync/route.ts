import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { and, eq, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { series } from '@/lib/db/schema'
import { getAnimeScheduleInfo, searchAnimeSchedule } from '@/lib/animeschedule'

export const maxDuration = 60

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function authorized(req: NextRequest) {
  const bearer = req.headers.get('authorization')
  const secret = req.headers.get('x-admin-secret')
  return (
    (!!process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`) ||
    (!!process.env.ADMIN_SYNC_SECRET && secret === process.env.ADMIN_SYNC_SECRET)
  )
}

type Row = {
  id: number
  title: string
  slug: string
  anilistId: number | null
  animescheduleSlug: string | null
}

async function syncOne(row: Row) {
  let slug = row.animescheduleSlug

  if (!slug) {
    const hits = await searchAnimeSchedule(row.title)
    let match = row.anilistId ? hits.filter((h) => h.aniListId === row.anilistId) : []
    if (match.length !== 1) {
      match = hits.filter((h) =>
        [h.title, h.english, h.romaji].some((n) => n && norm(n) === norm(row.title)),
      )
    }
    if (match.length !== 1) {
      return {
        seriesSlug: row.slug,
        ok: false,
        reason: 'no_unique_match',
        candidates: hits.slice(0, 5).map((h) => ({ route: h.route, title: h.title })),
      }
    }
    slug = match[0].route
  }

  const info = await getAnimeScheduleInfo(slug)
  if (!info) return { seriesSlug: row.slug, ok: false, reason: 'fetch_failed', animescheduleSlug: slug }

  try {
    await db
      .update(series)
      .set({ animescheduleSlug: slug, animescheduleData: info, animescheduleSyncedAt: new Date() })
      .where(eq(series.id, row.id))
  } catch {
    return { seriesSlug: row.slug, ok: false, reason: 'slug_already_used', animescheduleSlug: slug }
  }

  revalidatePath(`/episodes/${row.slug}`)
  return { seriesSlug: row.slug, ok: true, animescheduleSlug: slug }
}

// Manual: sync one series (optionally forcing the AnimeSchedule slug)
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (!body.seriesSlug) return NextResponse.json({ error: 'seriesSlug required' }, { status: 400 })

  const [row] = await db
    .select({
      id: series.id,
      title: series.title,
      slug: series.slug,
      anilistId: series.anilistId,
      animescheduleSlug: series.animescheduleSlug,
    })
    .from(series)
    .where(eq(series.slug, body.seriesSlug))
    .limit(1)
  if (!row) return NextResponse.json({ error: 'series not found' }, { status: 404 })

  const result = await syncOne({ ...row, animescheduleSlug: body.animescheduleSlug ?? row.animescheduleSlug })
  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}

// Cron: refresh ongoing series that already have a slug and are >23h stale
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000)

  const rows = await db
    .select({
      id: series.id,
      title: series.title,
      slug: series.slug,
      anilistId: series.anilistId,
      animescheduleSlug: series.animescheduleSlug,
    })
    .from(series)
    .where(
      and(
        isNotNull(series.animescheduleSlug),
        eq(series.status, 'ongoing'),
        or(isNull(series.animescheduleSyncedAt), lt(series.animescheduleSyncedAt, cutoff)),
      ),
    )
    .limit(10)

  const results = []
  for (const row of rows) {
    results.push(await syncOne(row))
    await sleep(1000)
  }
  return NextResponse.json({ processed: results.length, results })
}
