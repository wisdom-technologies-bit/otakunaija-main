'use client'

import OneSignal from 'react-onesignal'
import { useEffect } from 'react'

export function GenreTagger({ genre }: { genre: string | null }) {
  useEffect(() => {
    try {
      const tags = (genre || '')
        .split(',')
        .map((value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'))
        .filter(Boolean)
        .slice(0, 5)

      for (const slug of tags) {
        OneSignal.User.addTag(`g_${slug}`, '1')
      }
    } catch {
      // OneSignal may not be initialized or permitted yet.
    }
  }, [genre])

  return null
}

export default GenreTagger
