'use client'

import { useEffect, useRef } from 'react'
import { getEntry, saveProgress } from '@/lib/watch-history'

type WatchProgressTrackerProps = {
  seriesSlug: string
  episodeSlug: string
  seriesTitle: string
  epNumber: number
  thumb: string | null
  durationSeconds: number
}

export function WatchProgressTracker({
  seriesSlug,
  episodeSlug,
  seriesTitle,
  epNumber,
  thumb,
  durationSeconds,
}: WatchProgressTrackerProps) {
  const lastSavedAtRef = useRef(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const entry = { seriesSlug, episodeSlug, seriesTitle, epNumber, thumb }
    let restoreHandled = false

    const saveVideoProgress = (video: HTMLVideoElement, force = false) => {
      const now = Date.now()
      if (!force && now - lastSavedAtRef.current < 5000) return
      const duration = Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : durationSeconds
      const position = Number.isFinite(video.currentTime) && video.currentTime >= 0
        ? video.currentTime
        : 0
      saveProgress({ ...entry, positionSeconds: position, durationSeconds: Number.isFinite(duration) ? duration : 0, updatedAt: now })
      lastSavedAtRef.current = now
    }

    const handleLoadedMetadata = (event: Event) => {
      const video = event.currentTarget as HTMLVideoElement
      if (restoreHandled) return
      restoreHandled = true
      const saved = getEntry(episodeSlug)
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationSeconds
      if (!saved || duration <= 0) return
      if (saved.positionSeconds >= duration * 0.95) {
        saveProgress({ ...entry, positionSeconds: 0, durationSeconds: duration, updatedAt: Date.now() })
        return
      }
      if (saved.positionSeconds > 10 && saved.positionSeconds < duration * 0.95) {
        video.currentTime = saved.positionSeconds
      }
    }

    const attach = () => {
      const video = document.querySelector<HTMLVideoElement>('video')
      if (!video || video === videoRef.current) return Boolean(video)
      videoRef.current = video
      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      video.addEventListener('timeupdate', handleTimeUpdate)
      video.addEventListener('pause', handlePause)
      if (video.readyState >= 1) handleLoadedMetadata({ currentTarget: video } as unknown as Event)
      return true
    }

    const handleTimeUpdate = (event: Event) => saveVideoProgress(event.currentTarget as HTMLVideoElement)
    const handlePause = (event: Event) => saveVideoProgress(event.currentTarget as HTMLVideoElement, true)
    const handlePageExit = () => {
      if (videoRef.current) saveVideoProgress(videoRef.current, true)
    }

    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    attach()
    document.addEventListener('visibilitychange', handlePageExit)
    window.addEventListener('pagehide', handlePageExit)

    return () => {
      observer.disconnect()
      const video = videoRef.current
      if (video) {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
        video.removeEventListener('timeupdate', handleTimeUpdate)
        video.removeEventListener('pause', handlePause)
      }
      document.removeEventListener('visibilitychange', handlePageExit)
      window.removeEventListener('pagehide', handlePageExit)
    }
  }, [durationSeconds, epNumber, episodeSlug, seriesSlug, seriesTitle, thumb])

  return null
}
