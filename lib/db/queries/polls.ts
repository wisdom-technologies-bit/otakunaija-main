import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { pollOptions, pollViews, pollVotes, polls } from '@/lib/db/schema'

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

export async function getPublicPolls(filter: 'all' | 'active' | 'ended' = 'all') {
  const now = new Date()
  const condition = filter === 'active'
    ? and(eq(polls.status, 'ACTIVE'), sql`(${polls.startsAt} is null or ${polls.startsAt} <= ${now})`, sql`(${polls.endsAt} is null or ${polls.endsAt} > ${now})`)
    : filter === 'ended'
      ? sql`(${polls.status} = 'ENDED' or (${polls.status} = 'ACTIVE' and ${polls.endsAt} is not null and ${polls.endsAt} <= ${now}))`
      : sql`(${polls.status} = 'ACTIVE' or ${polls.status} = 'ENDED')`

  const rows = await db.select().from(polls).where(condition).orderBy(desc(polls.featured), desc(polls.createdAt))
  if (!rows.length) return []
  const options = await db.select().from(pollOptions).where(and(inArray(pollOptions.pollId, rows.map((p) => p.id)), eq(pollOptions.isActive, true))).orderBy(asc(pollOptions.displayOrder))
  const counts = await db.select({ pollId: pollVotes.pollId, count: sql<number>`count(*)::int` }).from(pollVotes).where(inArray(pollVotes.pollId, rows.map((p) => p.id))).groupBy(pollVotes.pollId)
  const countMap = new Map(counts.map((c) => [c.pollId, c.count]))
  return rows.map((poll) => ({ ...poll, options: options.filter((o) => o.pollId === poll.id), totalVotes: countMap.get(poll.id) || 0 }))
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

export async function getPollAnalytics(pollId: number) {
  const [{ votes }] = await db.select({ votes: sql<number>`count(*)::int` }).from(pollVotes).where(eq(pollVotes.pollId, pollId))
  const [{ views }] = await db.select({ views: sql<number>`count(*)::int` }).from(pollViews).where(eq(pollViews.pollId, pollId))
  const countries = await db.select({ name: pollVotes.countryName, code: pollVotes.countryCode, count: sql<number>`count(*)::int` }).from(pollVotes).where(and(eq(pollVotes.pollId, pollId), sql`${pollVotes.countryCode} is not null`)).groupBy(pollVotes.countryName, pollVotes.countryCode).orderBy(desc(sql`count(*)`)).limit(20)
  const devices = await db.select({ device: pollVotes.deviceType, count: sql<number>`count(*)::int` }).from(pollVotes).where(eq(pollVotes.pollId, pollId)).groupBy(pollVotes.deviceType).orderBy(desc(sql`count(*)`))
  const timeline = await db.select({ bucket: sql<string>`to_char(date_trunc('day', ${pollVotes.votedAt}), 'YYYY-MM-DD')`, count: sql<number>`count(*)::int` }).from(pollVotes).where(eq(pollVotes.pollId, pollId)).groupBy(sql`date_trunc('day', ${pollVotes.votedAt})`).orderBy(sql`date_trunc('day', ${pollVotes.votedAt})`)
  return { votes: votes || 0, views: views || 0, conversion: views ? ((votes || 0) / views) * 100 : 0, countries, devices, timeline }
}

export async function getAdminPolls() {
  const rows = await db.select().from(polls).orderBy(desc(polls.createdAt))
  if (!rows.length) return []
  const counts = await db.select({ pollId: pollVotes.pollId, count: sql<number>`count(*)::int` }).from(pollVotes).where(inArray(pollVotes.pollId, rows.map((p) => p.id))).groupBy(pollVotes.pollId)
  const countMap = new Map(counts.map((c) => [c.pollId, c.count]))
  return rows.map((poll) => ({ ...poll, totalVotes: countMap.get(poll.id) || 0 }))
}

export async function trackPollView(pollId: number, deviceId: string, source?: string) {
  await db.insert(pollViews).values({ pollId, deviceId, source })
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
