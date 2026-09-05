import { NextResponse } from 'next/server'
import { headers, cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { pollVotes } from '@/lib/db/schema'
import { getPollById, getPollOptionIds, getPollVoteByHash, insertPollVote } from '@/lib/db/queries/polls'
import { detectDeviceType, getClientIp, getGeolocation, hashUserAgent, hashVoter, isPollOpen } from '@/lib/poll-utils'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { pollId?: number; optionIds?: number[] }
    const pollId = Number(body.pollId)
    const optionIds = Array.isArray(body.optionIds) ? body.optionIds.map(Number).filter(Number.isInteger) : []
    if (!Number.isInteger(pollId) || optionIds.length === 0) return NextResponse.json({ error: 'Choose at least one option.' }, { status: 400 })

    const poll = await getPollById(pollId)
    if (!poll) return NextResponse.json({ error: 'Poll not found.' }, { status: 404 })
    if (!isPollOpen(poll)) return NextResponse.json({ error: poll.startsAt && new Date() < poll.startsAt ? 'This poll has not started yet.' : 'This poll has ended.' }, { status: 409 })
    if (!poll.allowMultipleVotes && optionIds.length !== 1) return NextResponse.json({ error: 'Choose one option.' }, { status: 400 })
    if (poll.allowMultipleVotes && optionIds.length > 5) return NextResponse.json({ error: 'Choose up to five options.' }, { status: 400 })

    const validIds = new Set((await getPollOptionIds(pollId)).map((option) => option.id))
    if (optionIds.some((id) => !validIds.has(id)) || new Set(optionIds).size !== optionIds.length) return NextResponse.json({ error: 'Invalid poll option.' }, { status: 400 })

    const requestHeaders = await headers()
    const requestCookies = await cookies()
    const userAgent = requestHeaders.get('user-agent') || 'unknown'
    const ip = getClientIp(requestHeaders.get('x-forwarded-for'), requestHeaders.get('x-real-ip'))
    const voterHash = hashVoter(ip, pollId, userAgent)
    if (await getPollVoteByHash(pollId, voterHash).then((rows) => rows.length > 0)) return NextResponse.json({ error: 'You have already voted in this poll.' }, { status: 409 })

    const geo = await getGeolocation(ip)
    const base = { pollId, voterHash, countryCode: geo?.country_code, countryName: geo?.country_name, region: geo?.region, city: geo?.city, timezone: geo?.timezone, continent: geo?.continent, deviceType: detectDeviceType(userAgent), userAgentHash: hashUserAgent(userAgent), referrer: requestHeaders.get('referer')?.slice(0, 500) }
    for (const optionId of optionIds) await insertPollVote({ ...base, optionId })

    requestCookies.set(`poll-voted-${pollId}`, '1', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365, path: '/' })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) return NextResponse.json({ error: 'You have already voted in this poll.' }, { status: 409 })
    return NextResponse.json({ error: 'Unable to record your vote right now.' }, { status: 500 })
  }
}
