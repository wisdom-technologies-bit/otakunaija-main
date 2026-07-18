import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { recordEpisodeWatchPing } from '@/lib/db/queries'

const DEVICE_ID_COOKIE = 'otakunaija_device_id'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const episodeId = parseInt(id, 10)

    if (!episodeId || isNaN(episodeId)) {
      return NextResponse.json({ error: 'Invalid episode ID' }, { status: 400 })
    }

    const body = await request.json()
    const minutesWatched = body.minutesWatched || 1

    // Get device ID from cookie
    const cookieStore = await cookies()
    const deviceId = cookieStore.get(DEVICE_ID_COOKIE)?.value

    if (!deviceId) {
      return NextResponse.json({ error: 'No device ID cookie found' }, { status: 401 })
    }

    // Record the watch ping
    const result = await recordEpisodeWatchPing(episodeId, deviceId, minutesWatched)

    if (!result.accepted) {
      return NextResponse.json(
        { error: result.reason || 'Ping rejected' },
        { status: 429 } // Too many requests for ping_too_soon
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error processing watch ping:', err)
    return NextResponse.json({ error: 'Failed to process ping' }, { status: 500 })
  }
}
