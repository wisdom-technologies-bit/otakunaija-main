import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { getTrendingSeries } from '@/lib/db/queries'
import { db } from '@/lib/db/index'
import { episodes, pushEvents, series } from '@/lib/db/schema'
import { sendPush } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const templates = [
  (title: string) => `Have you watched ${title} yet?`,
  (title: string) => `Trending on OtakuNaija: ${title}`,
  (title: string) => `Your next binge: ${title}`,
]

function authorized(request: NextRequest) {
  return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

function genreTag(genre: string | null) {
  return genre?.split(',')[0]?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || null
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dry = request.nextUrl.searchParams.get('dry') === '1'
  const all = request.nextUrl.searchParams.get('all') === '1'
  const now = new Date()
  const recentSuggestion = await db
    .select({ id: pushEvents.id })
    .from(pushEvents)
    .where(and(eq(pushEvents.type, 'suggestion'), eq(pushEvents.status, 'sent'), gt(pushEvents.sentAt, sql`now() - interval '20 hours'`)))
    .limit(1)

  if (recentSuggestion.length) return NextResponse.json({ sent: false, reason: 'suggestion_sent_within_20_hours', notification: null })

  const trending = await getTrendingSeries(15)
  const trendingIds = trending.map(({ series: item }) => item.id)
  if (!trendingIds.length) return NextResponse.json({ sent: false, reason: 'no_candidates', notification: null })

  const candidates = await db
    .select({
      id: series.id,
      title: series.title,
      slug: series.slug,
      genre: series.genre,
      coverImageUrl: series.coverImageUrl,
      episodeCount: sql<number>`count(${episodes.id})`,
    })
    .from(series)
    .innerJoin(episodes, eq(episodes.seriesId, series.id))
    .where(and(eq(series.status, 'ongoing'), inArray(series.id, trendingIds)))
    .groupBy(series.id)
    .having(sql`count(${episodes.id}) > 0`)
    .orderBy(desc(sql`count(${episodes.id})`))

  const excluded = await db
    .select({ contentId: pushEvents.contentId })
    .from(pushEvents)
    .where(and(eq(pushEvents.type, 'suggestion'), eq(pushEvents.status, 'sent'), gt(pushEvents.sentAt, sql`now() - interval '30 days'`)))
  const excludedIds = new Set(excluded.map(({ contentId }) => contentId))
  const available = candidates.filter((candidate) => !excludedIds.has(candidate.id))
  if (!available.length) return NextResponse.json({ sent: false, reason: 'no_candidates', notification: null })

  const candidate = available[Math.floor(Math.random() * available.length)]
  const message = templates[Math.floor(now.getTime() / 86_400_000) % templates.length](candidate.title)
  const notification = {
    title: 'OtakuNaija suggestion',
    message,
    path: `/episodes/${candidate.slug}`,
    image: candidate.coverImageUrl,
    ...(all ? {} : { filters: genreTag(candidate.genre) ? [{ field: 'tag', key: `g_${genreTag(candidate.genre)}`, relation: '=', value: '1' }] : undefined }),
  }

  if (dry) return NextResponse.json({ sent: false, dry: true, notification })

  let result = await sendPush(notification)
  let fallback = false
  if (!result.ok && notification.filters && result.error?.includes('not subscribed')) {
    fallback = true
    const { filters: _filters, ...fallbackNotification } = notification
    result = await sendPush(fallbackNotification)
  }
  const [event] = await db.insert(pushEvents).values({ type: 'suggestion', contentId: candidate.id, status: result.ok && result.id ? 'sent' : 'failed', lastError: result.ok ? null : result.error }).returning({ id: pushEvents.id })
  return NextResponse.json({ sent: Boolean(result.ok && result.id), eventId: event?.id, notification, result, ...(fallback ? { fallback: true } : {}) })
}
