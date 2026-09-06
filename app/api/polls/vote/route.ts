import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { consumePollVoteRateLimit, insertPollVote, getPollById, getPollOptionIds, reservePollVote } from '@/lib/db/queries/polls'
import { detectDeviceType, getClientIp, getGeolocation, hashUserAgent, hashVoter, isPollOpen, normalizeGeolocation, POLL_VISITOR_COOKIE } from '@/lib/poll-utils'
import { randomUUID } from 'crypto'

const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60
const MAX_OPTIONS = 5

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { pollId?: unknown; optionIds?: unknown }
    const pollId = typeof body.pollId === 'number' && Number.isInteger(body.pollId) ? body.pollId : Number(body.pollId)
    const optionIds = Array.isArray(body.optionIds) ? body.optionIds.map(Number) : []
    if (!Number.isInteger(pollId) || optionIds.length === 0 || optionIds.some((id) => !Number.isInteger(id))) return errorResponse('Choose at least one option.', 400)
    if (new Set(optionIds).size !== optionIds.length) return errorResponse('Invalid poll option.', 400)

    const poll = await getPollById(pollId)
    if (!poll) return errorResponse('Poll not found.', 404)
    const now = new Date()
    if (poll.status !== 'ACTIVE' || (poll.startsAt && now < poll.startsAt)) return errorResponse(poll.startsAt && now < poll.startsAt ? "Voting hasn't started yet." : 'This poll has ended.', 409)
    if (poll.endsAt && now >= poll.endsAt) return errorResponse('This poll has ended.', 409)
    if ((!poll.allowMultipleVotes && optionIds.length !== 1) || (poll.allowMultipleVotes && optionIds.length > MAX_OPTIONS)) return errorResponse(poll.allowMultipleVotes ? `Choose up to ${MAX_OPTIONS} options.` : 'Choose one option.', 400)

    const validIds = new Set((await getPollOptionIds(pollId)).map((option) => option.id))
    if (optionIds.some((id) => !validIds.has(id))) return errorResponse('Invalid poll option.', 400)

    const requestHeaders = await headers()
    const requestCookies = await cookies()
    const userAgent = requestHeaders.get('user-agent') || 'unknown'
    const ip = getClientIp(requestHeaders.get('x-forwarded-for'), requestHeaders.get('x-real-ip'))
    let visitorId = requestCookies.get(POLL_VISITOR_COOKIE)?.value
    const shouldSetVisitorCookie = !visitorId
    visitorId ||= randomUUID()
    const voterHash = hashVoter(`${visitorId}:${ip}`, pollId, userAgent)
    if (!(await consumePollVoteRateLimit(hashVoter(`${ip}:${userAgent}`, 0, 'poll-vote-rate')))) return errorResponse('Too many attempts right now. Please try again shortly.', 429)

    // The submission reservation is the atomic duplicate guard for both single- and multi-choice polls.
    if (!(await reservePollVote(pollId, voterHash))) return errorResponse("You've already voted in this poll.", 409)

    const geo = await getGeolocation(ip)
    const location = normalizeGeolocation({
      // All values originate from server request headers or the server-side IP provider.
      // Provider names take precedence over Vercel's abbreviated region headers.
      countryCode: requestHeaders.get('x-vercel-ip-country') || geo?.country_code,
      countryName: geo?.country_name,
      region: geo?.region || requestHeaders.get('x-vercel-ip-country-region'),
      city: geo?.city || requestHeaders.get('x-vercel-ip-city'),
      timezone: geo?.timezone || requestHeaders.get('x-vercel-ip-timezone'),
      continent: geo?.continent,
    })
    const referrer = requestHeaders.get('referer')?.slice(0, 500) || null
    const base = { pollId, voterHash, countryCode: location.countryCode, countryName: location.countryName, region: location.region, city: location.city, timezone: location.timezone, continent: location.continent, deviceType: detectDeviceType(userAgent), userAgentHash: hashUserAgent(userAgent), referrer }
    for (const optionId of optionIds) await insertPollVote({ ...base, optionId })

    if (shouldSetVisitorCookie) requestCookies.set(POLL_VISITOR_COOKIE, visitorId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: VISITOR_COOKIE_MAX_AGE, path: '/' })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[v0] poll vote failed', error)
    return errorResponse('Something went wrong. Please try again.', 500)
  }
}
