'use client'

import { useEffect, useRef } from 'react'
import { trackHomepagePollView } from '@/lib/actions/track-view'

export function PollImpressionTracker({ pollIds }: { pollIds: number[] }) {
  const tracked = useRef(false)
  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    for (const pollId of pollIds) void trackHomepagePollView(pollId)
  }, [pollIds])
  return null
}
