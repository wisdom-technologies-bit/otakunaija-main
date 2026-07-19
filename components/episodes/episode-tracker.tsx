'use client'

import { useEffect, useRef, useCallback } from 'react'
import { trackEpisodeView } from '@/lib/actions/track-view'

interface EpisodeTrackerProps {
  episodeId: number
  videoPlayerSelector?: string
}

export function EpisodeTracker({ episodeId, videoPlayerSelector = 'video' }: EpisodeTrackerProps) {
  const watchTimeRef = useRef(0)
  const isPlayingRef = useRef(false)
  const lastPingRef = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Track view on mount
  useEffect(() => {
    trackEpisodeView(episodeId)
  }, [episodeId])

  // Setup watch-time tracking
  useEffect(() => {
    let video: HTMLVideoElement | null = null
    let cleanupListeners: (() => void) | null = null

    const attachListeners = (videoEl: HTMLVideoElement) => {
      const handlePlay = () => {
        isPlayingRef.current = true
      }
      const handlePause = () => {
        isPlayingRef.current = false
      }
      const handleVisibilityChange = () => {
        if (document.hidden) {
          isPlayingRef.current = false
        }
      }
      const handleBeforeUnload = () => {
        isPlayingRef.current = false
      }

      videoEl.addEventListener('play', handlePlay)
      videoEl.addEventListener('pause', handlePause)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('beforeunload', handleBeforeUnload)

      cleanupListeners = () => {
        videoEl.removeEventListener('play', handlePlay)
        videoEl.removeEventListener('pause', handlePause)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }

    // The <video> element doesn't exist until the user clicks play,
    // so watch the DOM for it to appear instead of checking once on mount
    const observer = new MutationObserver(() => {
      const found = document.querySelector<HTMLVideoElement>(videoPlayerSelector)
      if (found && found !== video) {
        video = found
        attachListeners(video)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    // Also check immediately in case it's already there
    const existing = document.querySelector<HTMLVideoElement>(videoPlayerSelector)
    if (existing) {
      video = existing
      attachListeners(video)
    }

    const handlePlay = () => {
      // Track watch time every second
      const trackWatchTime = () => {
        if (isPlayingRef.current) {
          watchTimeRef.current += 1

          // Send ping every 60 seconds of accumulated watch time
          if (watchTimeRef.current % 60 === 0) {
            const now = Date.now()
            const timeSinceLastPing = now - lastPingRef.current

            // Only send if at least 50 seconds have passed since last ping
            if (timeSinceLastPing >= 50000) {
              lastPingRef.current = now
              fetch(`/api/episodes/${episodeId}/watch-ping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ minutesWatched: 1 }),
              }).catch(err => console.error('Failed to send watch ping:', err))
            }
          }
        }
      }

      intervalRef.current = setInterval(trackWatchTime, 1000)

      video.addEventListener('play', handlePlay)
      video.addEventListener('pause', handlePause)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('beforeunload', handleBeforeUnload)

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        video.removeEventListener('play', handlePlay)
        video.removeEventListener('pause', handlePause)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }, [episodeId])

  return null
}
