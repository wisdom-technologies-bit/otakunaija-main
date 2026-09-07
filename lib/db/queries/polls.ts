import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { pollOptions, pollViews, pollVoteSubmissions, pollVotes, polls, rateLimits } from '@/lib/db/schema'

export type PublicPoll = {
  id: number
  title: string
  slug: string
  description: string | null
  status: string
  featured: boolean
  allowMultipleVotes: boolean
  startsAt: Date | null
  endsAt: Date | null
  createdAt: Date
  options: Array<{
    id: number
    label: string
    description: string | null
    imageUrl: string | null
    displayOrder: number
  }>
  totalVotes: number
}

export async function getPollWithOptions(id: number) {
  const [poll] = await db.select().from(polls).where(eq(polls.id, id)).limit(1)
  if (!poll) return null
  const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, id)).orderBy(asc(pollOptions.displayOrder), asc(pollOptions.id))
  return { ...poll, options }
}

export async function getPollBySlug(slug: string) {
  const [poll] = await db.select().from(polls).where(eq(polls.slug, slug)).limit(1)
  if (!poll || poll.status === 'DRAFT') return null
  const options = await db.select().from(pollOptions).where(and(eq(pollOptions.pollId, poll.id), eq(pollOptions.isActive, true))).orderBy(asc(pollOptions.displayOrder), asc(pollOptions.id))
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(pollVotes).where(eq(pollVotes.pollId, poll.id))
  return { ...poll, options, totalVotes: count || 0 }
}

export async function getPublicPolls({ filter = 'all', query = '', page = 1, pageSize = 12 }: { filter?: 'all' | 'active' | 'upcoming' | 'ended'; query?: string; page?: number; pageSize?: number } = {}) {
  const now = new Date()
  const lifecycle = filter === 'active'
    ? and(eq(polls.status, 'ACTIVE'), sql`(${polls.startsAt} is null or ${polls.startsAt} <= ${now})`, sql`(${polls.endsAt} is null or ${polls.endsAt} > ${now})`)
    : filter === 'upcoming'
      ? and(eq(polls.status, 'ACTIVE'), sql`${polls.startsAt} > ${now}`)
      : filter === 'ended'
        ? sql`(${polls.status} = 'ENDED' or (${polls.status} = 'ACTIVE' and ${polls.endsAt} is not null and ${polls.endsAt} <= ${now}))`
        : sql`(${polls.status} = 'ACTIVE' or ${polls.status} = 'ENDED')`
  const search = query.trim() ? sql`(${polls.title} ilike ${`%${query.trim()}%`} or coalesce(${polls.description}, '') ilike ${`%${query.trim()}%`})` : undefined
  const where = search ? and(lifecycle, search) : lifecycle
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(polls).where(where)
  const rows = await db.select().from(polls).where(where).orderBy(desc(polls.featured), desc(polls.createdAt)).limit(pageSize).offset((Math.max(1, page) - 1) * pageSize)
  if (!rows.length) return { polls: [], total: total || 0, page, pageSize }
  const ids = rows.map((p) => p.id)
  const options = await db.select().from(pollOptions).where(and(inArray(pollOptions.pollId, ids), eq(pollOptions.isActive, true))).orderBy(asc(pollOptions.displayOrder))
  const counts = await db.select({ pollId: pollVotes.pollId, count: sql<number>`count(*)::int` }).from(pollVotes).where(inArray(pollVotes.pollId, ids)).groupBy(pollVotes.pollId)
  const countMap = new Map(counts.map((c) => [c.pollId, c.count]))
  return { polls: rows.map((poll) => ({ ...poll, options: options.filter((o) => o.pollId === poll.id), totalVotes: countMap.get(poll.id) || 0 })), total: total || 0, page, pageSize }
}

export async function getPlacementPoll() {
  const now = new Date()
  const [poll] = await db.select().from(polls).where(and(eq(polls.status, 'ACTIVE'), sql`(${polls.startsAt} is null or ${polls.startsAt} <= ${now})`, sql`(${polls.endsAt} is null or ${polls.endsAt} > ${now})`)).orderBy(desc(polls.featured), desc(polls.updatedAt), desc(polls.id)).limit(1)
  if (!poll) return null
  const options = await db.select().from(pollOptions).where(and(eq(pollOptions.pollId, poll.id), eq(pollOptions.isActive, true))).orderBy(asc(pollOptions.displayOrder), asc(pollOptions.id))
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(pollVotes).where(eq(pollVotes.pollId, poll.id))
  return { ...poll, options, totalVotes: count || 0 }
}

export async function getRandomActivePolls(limit = 5) {
  const now = new Date()
  const rows = await db.select().from(polls).where(and(eq(polls.status, 'ACTIVE'), sql`(${polls.startsAt} is null or ${polls.startsAt} <= ${now})`, sql`(${polls.endsAt} is null or ${polls.endsAt} > ${now})`)).orderBy(sql`random()`).limit(limit)
  if (!rows.length) return []
  const options = await db.select().from(pollOptions).where(and(inArray(pollOptions.pollId, rows.map((p) => p.id)), eq(pollOptions.isActive, true))).orderBy(asc(pollOptions.displayOrder))
  return rows.map((poll) => ({ ...poll, options: options.filter((o) => o.pollId === poll.id) }))
}

export async function getPollVotes(pollId: number) {
  return db.select({ optionId: pollVotes.optionId, countryCode: pollVotes.countryCode, countryName: pollVotes.countryName, region: pollVotes.region, city: pollVotes.city, deviceType: pollVotes.deviceType, votedAt: pollVotes.votedAt }).from(pollVotes).where(eq(pollVotes.pollId, pollId)).orderBy(asc(pollVotes.votedAt))
}

function normalizeCountry(name: string, code: string | null) {
  const aliases: Record<string, string> = { NG: 'Nigeria', GH: 'Ghana', US: 'United States', GB: 'United Kingdom', CA: 'Canada', ZA: 'South Africa' }
  return aliases[code || ''] || name.replace(/%20/g, ' ')
}

function totalSelections(rows: Array<{ count: number }>) { return rows.reduce((sum, row) => sum + row.count, 0) }

export async function getPollAnalytics(pollId: number) {
  const [{ votes }] = await db.select({ votes: sql<number>`count(distinct ${pollVotes.voterHash})::int` }).from(pollVotes).where(eq(pollVotes.pollId, pollId))
  const [{ views }] = await db.select({ views: sql<number>`count(*) filter (where ${pollViews.source} <> 'result_view')::int` }).from(pollViews).where(eq(pollViews.pollId, pollId))
  const [{ resultViews }] = await db.select({ resultViews: sql<number>`count(*) filter (where ${pollViews.source} = 'result_view')::int` }).from(pollViews).where(eq(pollViews.pollId, pollId))
  const optionCounts = await db.select({ optionId: pollVotes.optionId, count: sql<number>`count(*)::int` }).from(pollVotes).where(eq(pollVotes.pollId, pollId)).groupBy(pollVotes.optionId).orderBy(desc(sql`count(*)`))
  const countries = await db.select({ name: sql<string>`coalesce(${pollVotes.countryName}, ${pollVotes.countryCode}, 'Unknown')`, code: pollVotes.countryCode, count: sql<number>`count(*)::int` }).from(pollVotes).where(eq(pollVotes.pollId, pollId)).groupBy(sql`coalesce(${pollVotes.countryName}, ${pollVotes.countryCode}, 'Unknown')`, pollVotes.countryCode).orderBy(desc(sql`count(*)`)).limit(20)
  const countryOptions = await db.select({ country: sql<string>`coalesce(${pollVotes.countryName}, ${pollVotes.countryCode}, 'Unknown')`, optionId: pollVotes.optionId, count: sql<number>`count(*)::int` }).from(pollVotes).where(and(eq(pollVotes.pollId, pollId), sql`coalesce(${pollVotes.countryName}, ${pollVotes.countryCode}) is not null`)).groupBy(pollVotes.countryName, pollVotes.countryCode, pollVotes.optionId).orderBy(sql`coalesce(${pollVotes.countryName}, ${pollVotes.countryCode})`, desc(sql`count(*)`))
  const devices = await db.select({ device: sql<string>`coalesce(${pollVotes.deviceType}, 'Unknown')`, count: sql<number>`count(*)::int` }).from(pollVotes).where(eq(pollVotes.pollId, pollId)).groupBy(sql`coalesce(${pollVotes.deviceType}, 'Unknown')`).orderBy(desc(sql`count(*)`))
  const sources = await db.select({ source: sql<string>`coalesce(${pollViews.source}, 'Unknown')`, count: sql<number>`count(*)::int` }).from(pollViews).where(and(eq(pollViews.pollId, pollId), sql`${pollViews.source} <> 'result_view'`)).groupBy(sql`coalesce(${pollViews.source}, 'Unknown')`).orderBy(desc(sql`count(*)`))
  const [duration] = await db.select({ first: sql<Date>`min(${pollVotes.votedAt})`, last: sql<Date>`max(${pollVotes.votedAt})` }).from(pollVotes).where(eq(pollVotes.pollId, pollId))
  const spanDays = duration?.first && duration?.last ? (new Date(duration.last).getTime() - new Date(duration.first).getTime()) / 86400000 : 0
  const bucket = spanDays < 1 ? 'hour' : spanDays < 32 ? 'day' : spanDays < 180 ? 'week' : 'month'
  const timelineQuery = bucket === 'hour'
    ? db.select({ bucket: sql<string>`to_char(date_trunc('hour', ${pollVotes.votedAt}), 'Mon DD HH24:00')`, count: sql<number>`count(*)::int`, respondents: sql<number>`count(distinct ${pollVotes.voterHash})::int` }).from(pollVotes).where(eq(pollVotes.pollId, pollId)).groupBy(sql`date_trunc('hour', ${pollVotes.votedAt})`).orderBy(sql`date_trunc('hour', ${pollVotes.votedAt})`)
    : bucket === 'week'
      ? db.select({ bucket: sql<string>`to_char(date_trunc('week', ${pollVotes.votedAt}), 'Mon DD')`, count: sql<number>`count(*)::int`, respondents: sql<number>`count(distinct ${pollVotes.voterHash})::int` }).from(pollVotes).where(eq(pollVotes.pollId, pollId)).groupBy(sql`date_trunc('week', ${pollVotes.votedAt})`).orderBy(sql`date_trunc('week', ${pollVotes.votedAt})`)
      : bucket === 'month'
        ? db.select({ bucket: sql<string>`to_char(date_trunc('month', ${pollVotes.votedAt}), 'Mon YYYY')`, count: sql<number>`count(*)::int`, respondents: sql<number>`count(distinct ${pollVotes.voterHash})::int` }).from(pollVotes).where(eq(pollVotes.pollId, pollId)).groupBy(sql`date_trunc('month', ${pollVotes.votedAt})`).orderBy(sql`date_trunc('month', ${pollVotes.votedAt})`)
        : db.select({ bucket: sql<string>`to_char(date_trunc('day', ${pollVotes.votedAt}), 'Mon DD')`, count: sql<number>`count(*)::int`, respondents: sql<number>`count(distinct ${pollVotes.voterHash})::int` }).from(pollVotes).where(eq(pollVotes.pollId, pollId)).groupBy(sql`date_trunc('day', ${pollVotes.votedAt})`).orderBy(sql`date_trunc('day', ${pollVotes.votedAt})`)
  const timeline = await timelineQuery
  const normalizedCountries = countries.map((row) => ({ ...row, name: normalizeCountry(row.name, row.code) }))
  return { votes: votes || 0, selections: totalSelections(optionCounts), respondents: votes || 0, views: views || 0, resultViews: resultViews || 0, conversion: views ? ((votes || 0) / views) * 100 : 0, optionCounts, countries: normalizedCountries, countryOptions, devices, sources, timeline }
}

export async function recordPollResultView(pollId: number, deviceId: string) {
  const existing = await db.select({ id: pollViews.id }).from(pollViews).where(and(eq(pollViews.pollId, pollId), eq(pollViews.deviceId, deviceId), eq(pollViews.source, 'result_view'))).limit(1)
  if (existing.length) return false
  await db.insert(pollViews).values({ pollId, deviceId, source: 'result_view' })
  return true
}

export async function getAdminPollDashboard() {
  const [summary] = await db.select({
    totalPolls: sql<number>`count(*)::int`,
    activePolls: sql<number>`count(*) filter (where ${polls.status} = 'ACTIVE')::int`,
    draftPolls: sql<number>`count(*) filter (where ${polls.status} = 'DRAFT')::int`,
    endedPolls: sql<number>`count(*) filter (where ${polls.status} = 'ENDED')::int`,
  }).from(polls)
  const [voteEngagement] = await db.select({ selections: sql<number>`count(*)::int`, voters: sql<number>`count(distinct ${pollVotes.voterHash})::int` }).from(pollVotes)
  const [viewEngagement] = await db.select({ views: sql<number>`count(*)::int` }).from(pollViews)
  const recent = await db.select({
    day: sql<string>`to_char(date_trunc('day', ${pollVotes.votedAt}), 'YYYY-MM-DD')`,
    selections: sql<number>`count(*)::int`,
    voters: sql<number>`count(distinct ${pollVotes.voterHash})::int`,
  }).from(pollVotes).where(gte(pollVotes.votedAt, sql`now() - interval '30 days'`)).groupBy(sql`date_trunc('day', ${pollVotes.votedAt})`).orderBy(sql`date_trunc('day', ${pollVotes.votedAt})`)
  return { summary: summary ?? { totalPolls: 0, activePolls: 0, draftPolls: 0, endedPolls: 0 }, engagement: { selections: voteEngagement?.selections ?? 0, voters: voteEngagement?.voters ?? 0, views: viewEngagement?.views ?? 0 }, recent }
}

export async function getAdminPolls() {
  const rows = await db.select().from(polls).orderBy(desc(polls.createdAt))
  if (!rows.length) return []
  const counts = await db.select({ pollId: pollVotes.pollId, count: sql<number>`count(*)::int` }).from(pollVotes).where(inArray(pollVotes.pollId, rows.map((p) => p.id))).groupBy(pollVotes.pollId)
  const countMap = new Map(counts.map((c) => [c.pollId, c.count]))
  return rows.map((poll) => ({ ...poll, totalVotes: countMap.get(poll.id) || 0 }))
}

export async function trackPollView(pollId: number, deviceId: string, source = 'homepage') {
  await db.insert(pollViews).values({ pollId, deviceId, source }).onConflictDoNothing()
}

export async function consumePollVoteRateLimit(identifier: string) {
  const [row] = await db.insert(rateLimits).values({ identifier, action: 'poll_vote', count: 1 }).onConflictDoUpdate({ target: [rateLimits.identifier, rateLimits.action], set: { count: sql`case when ${rateLimits.windowStart} < now() - interval '1 minute' then 1 else coalesce(${rateLimits.count}, 0) + 1 end`, windowStart: sql`case when ${rateLimits.windowStart} < now() - interval '1 minute' then now() else ${rateLimits.windowStart} end` } }).returning({ count: rateLimits.count })
  return (row?.count ?? 1) <= 10
}

export async function reservePollVote(pollId: number, voterHash: string) {
  const [submission] = await db.insert(pollVoteSubmissions).values({ pollId, voterHash }).onConflictDoNothing().returning({ id: pollVoteSubmissions.id })
  return Boolean(submission)
}

export async function getPublicPollSlugs() {
  return db.select({ slug: polls.slug, updatedAt: polls.updatedAt }).from(polls).where(inArray(polls.status, ['ACTIVE', 'ENDED']))
}

export async function getPollSummary() {
  const [summary] = await db.select({ total: sql<number>`count(*)::int`, active: sql<number>`count(*) filter (where ${polls.status} = 'ACTIVE')::int`, ended: sql<number>`count(*) filter (where ${polls.status} = 'ENDED')::int`, drafts: sql<number>`count(*) filter (where ${polls.status} = 'DRAFT')::int` }).from(polls)
  const [votes] = await db.select({ total: sql<number>`count(*)::int` }).from(pollVotes)
  return { ...summary, votes: votes?.total || 0 }
}

export async function getPollOptionVoteCounts(pollId: number) {
  return db.select({ optionId: pollVotes.optionId, count: sql<number>`count(*)::int` }).from(pollVotes).where(eq(pollVotes.pollId, pollId)).groupBy(pollVotes.optionId)
}

export async function getPollVoteByHash(pollId: number, voterHash: string) {
  return db.select({ id: pollVotes.id }).from(pollVotes).where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.voterHash, voterHash))).limit(1)
}

export async function getPollById(id: number) {
  return getPollWithOptions(id)
}

export async function updatePollStatus(id: number, status: 'DRAFT' | 'ACTIVE' | 'ENDED') {
  return db.update(polls).set({ status, updatedAt: new Date() }).where(eq(polls.id, id))
}

export async function deletePollById(id: number) {
  return db.delete(polls).where(eq(polls.id, id))
}

export async function insertPoll(values: typeof polls.$inferInsert) {
  const [created] = await db.insert(polls).values(values).returning()
  return created
}

export async function insertPollOptions(values: Array<typeof pollOptions.$inferInsert>) {
  if (values.length) await db.insert(pollOptions).values(values)
}

export async function updatePollById(id: number, values: Partial<typeof polls.$inferInsert>) {
  const [updated] = await db.update(polls).set({ ...values, updatedAt: new Date() }).where(eq(polls.id, id)).returning()
  return updated
}

export async function deletePollOptions(id: number) {
  await db.delete(pollOptions).where(eq(pollOptions.pollId, id))
}

export async function insertPollVote(values: typeof pollVotes.$inferInsert) {
  const [vote] = await db.insert(pollVotes).values(values).returning()
  return vote
}

export async function getPollOptionIds(pollId: number) {
  return db.select({ id: pollOptions.id }).from(pollOptions).where(and(eq(pollOptions.pollId, pollId), eq(pollOptions.isActive, true)))
}

export { polls, pollOptions, pollVotes, pollViews }
