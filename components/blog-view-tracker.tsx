'use client'

import { useEffect } from 'react'
import { trackPostView } from '@/lib/actions/track-view'

export function BlogViewTracker({ postId }: { postId: number }) {
  useEffect(() => {
    trackPostView(postId)
  }, [postId])

  return null
}
