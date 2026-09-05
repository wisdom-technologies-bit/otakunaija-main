'use server'

import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { recordPostView, recordEpisodeView } from '@/lib/db/queries'
import { trackPollView as recordPollView } from '@/lib/db/queries/polls'

const DEVICE_ID_COOKIE = 'otakunaija_device_id'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 year in seconds

// Get or create device ID
async function getOrCreateDeviceId(): Promise<string> {
  const cookieStore = await cookies()
  let deviceId = cookieStore.get(DEVICE_ID_COOKIE)?.value

  if (!deviceId) {
    // Generate new device ID
    deviceId = randomUUID()

    // Set cookie
    cookieStore.set(DEVICE_ID_COOKIE, deviceId, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    })
  }

  return deviceId
}

export async function trackPostView(postId: number) {
  try {
    const deviceId = await getOrCreateDeviceId()
    await recordPostView(postId, deviceId)
  } catch (err) {
    console.error('Failed to track post view:', err)
  }
}

export async function trackEpisodeView(episodeId: number) {
  try {
    const deviceId = await getOrCreateDeviceId()
    await recordEpisodeView(episodeId, deviceId)
  } catch (err) {
    console.error('Failed to track episode view:', err)
  }
}

export async function trackHomepagePollView(pollId: number) {
  try {
    const deviceId = await getOrCreateDeviceId()
    await recordPollView(pollId, deviceId, 'homepage')
  } catch (err) {
    console.error('Failed to track poll view:', err)
  }
}
