'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

interface LiveViewerWidgetProps {
  episodeUrl: string
  videoPlayerSelector?: string
}

export function LiveViewerWidget({
  episodeUrl,
  videoPlayerSelector = 'video',
}: LiveViewerWidgetProps) {
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const initializedRef = useRef(false)

  // Watch for the video to appear and start playing, same pattern as EpisodeTracker
  useEffect(() => {
    if (hasStartedPlaying) return

    let video: HTMLVideoElement | null = null
    let cleanup: (() => void) | null = null

    const attachPlayListener = (videoEl: HTMLVideoElement) => {
      const handlePlay = () => setHasStartedPlaying(true)
      videoEl.addEventListener('play', handlePlay, { once: true })
      cleanup = () => videoEl.removeEventListener('play', handlePlay)
    }

    const observer = new MutationObserver(() => {
      const found = document.querySelector<HTMLVideoElement>(videoPlayerSelector)
      if (found && found !== video) {
        video = found
        attachPlayListener(video)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    const existing = document.querySelector<HTMLVideoElement>(videoPlayerSelector)
    if (existing) {
      video = existing
      attachPlayListener(video)
    }

    return () => {
      observer.disconnect()
      if (cleanup) cleanup()
    }
  }, [hasStartedPlaying, videoPlayerSelector])

  // Once the video has started AND the widget script has loaded, initialize
  useEffect(() => {
    if (!hasStartedPlaying || !scriptLoaded || initializedRef.current) return
    initializedRef.current = true
    // @ts-expect-error - OtakuViewersWidget is loaded globally by widget.js
    window.OtakuViewersWidget?.init({
      container: '#otaku-viewers',
      episode_url: episodeUrl,
      style: 'compact',
      theme: 'dark',
    })
  }, [hasStartedPlaying, scriptLoaded, episodeUrl])

  return (
    <>
      {hasStartedPlaying && (
        <>
          <div id="otaku-viewers" />
          <Script
            src="https://otakunaija-live.vercel.app/widget.js"
            strategy="lazyOnload"
            onLoad={() => setScriptLoaded(true)}
          />
        </>
      )}
    </>
  )
}