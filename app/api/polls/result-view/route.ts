import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { recordPollResultView } from '@/lib/db/queries/polls'
import { hashVoter, POLL_VISITOR_COOKIE } from '@/lib/poll-utils'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { pollId?: unknown }
    const pollId = Number(body.pollId)
    if (!Number.isInteger(pollId)) return NextResponse.json({ error: 'Invalid poll.' }, { status: 400 })
    const cookie = (await cookies()).get(POLL_VISITOR_COOKIE)?.value
    const deviceId = hashVoter(cookie || 'anonymous-result-view', pollId, 'result-view')
    await recordPollResultView(pollId, deviceId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to record result view.' }, { status: 500 })
  }
}
