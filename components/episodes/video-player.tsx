'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Play } from 'lucide-react'
import * as PlyrModule from 'plyr'

const Plyr = PlyrModule.default
import 'plyr/dist/plyr.css'

interface VideoPlayerProps {
  videoUrl: string | null
  thumbnailUrl: string
  title: string
  subtitlesUrl?: string | null
  playId?: string | null
}

interface ResolvedPlayback {
  streamUrl: string
  subtitleUrl: string | null
  type: string
  provider: string
  server: string | null
}

function isHlsStream(url: string, type: string): boolean {
  try {
    return type === 'hls' || /\.m3u8$/i.test(new URL(url, window.location.origin).pathname)
  } catch {
    return type === 'hls' || /\.m3u8(?:$|[?#])/i.test(url)
  }
}

const PLAY_RESOLVE_BASE_URL = 'https://play.otakunaija.name.ng'
const MAX_RETRY_ATTEMPTS = 4

export function VideoPlayer({ videoUrl, thumbnailUrl, title, subtitlesUrl, playId }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [resolvedPlayback, setResolvedPlayback] = useState<ResolvedPlayback | null>(null)
  const [isResolving, setIsResolving] = useState(Boolean(playId?.trim()))
  const [resolveFailed, setResolveFailed] = useState(false)
  const [excludedCandidates, setExcludedCandidates] = useState<string[]>([])
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [retryStatus, setRetryStatus] = useState<'idle' | 'retrying' | 'exhausted'>('idle')
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Plyr | null>(null)
  const hlsInstanceRef = useRef<import('hls.js').default | null>(null)
  const retryStatusRef = useRef(retryStatus)
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const plyrInitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sourceGenerationRef = useRef(0)
  const [hlsMode, setHlsMode] = useState<'pending' | 'native' | 'hls' | 'fallback'>('pending')

  // Plyr mutates the video subtree. Destroy it before React replaces that subtree
  // so Plyr cannot remove nodes that React has already detached.
  const destroyPlayer = useCallback(() => {
    if (plyrInitTimeoutRef.current) {
      clearTimeout(plyrInitTimeoutRef.current)
      plyrInitTimeoutRef.current = null
    }
    const player = playerRef.current
    playerRef.current = null
    if (!player) return
    try {
      player.destroy()
    } catch (error) {
      console.warn('Failed to clean up Plyr instance', error)
    }
  }, [])

  useEffect(() => {
    retryStatusRef.current = retryStatus
  }, [retryStatus])

  const resolvePlayback = useCallback(async (excludeList: string[]) => {
    const normalizedPlayId = playId?.trim()
    if (!normalizedPlayId) return

    const controller = new AbortController()
    setIsResolving(true)
    try {
      const query = excludeList.length ? `?exclude=${encodeURIComponent(excludeList.join(','))}` : ''
      const response = await fetch(
        `${PLAY_RESOLVE_BASE_URL}/api/watch/${encodeURIComponent(normalizedPlayId)}${query}`,
        { signal: controller.signal },
      )
      if (!response.ok) throw new Error(`Playback resolution failed: ${response.status}`)
      const data = await response.json()
      if (typeof data.streamUrl !== 'string' || !data.streamUrl) throw new Error('Missing stream URL')
      const subtitles = Array.isArray(data.subtitles) ? data.subtitles : []
      const subtitle = subtitles.find((track: { default?: boolean }) => track.default) ?? subtitles[0]
      const rawSubtitleUrl = typeof subtitle?.url === 'string' ? subtitle.url : null
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current)
      sourceGenerationRef.current += 1
      setResolvedPlayback({
        streamUrl: data.streamUrl.startsWith('http') ? data.streamUrl : `${PLAY_RESOLVE_BASE_URL}${data.streamUrl}`,
        subtitleUrl: rawSubtitleUrl
          ? rawSubtitleUrl.startsWith('http') ? rawSubtitleUrl : `${PLAY_RESOLVE_BASE_URL}${rawSubtitleUrl}`
          : null,
        type: typeof data.type === 'string' ? data.type : 'mp4',
        provider: typeof data.provider === 'string' ? data.provider : '',
        server: typeof data.server === 'string' ? data.server : null,
      })
      setResolveFailed(false)
      setRetryStatus('idle')
      retryStatusRef.current = 'idle'
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error('Failed to resolve episode playback', error)
      if (retryStatusRef.current === 'retrying' && excludeList.length > 0) {
        setRetryStatus('exhausted')
        retryStatusRef.current = 'exhausted'
      }
      setResolveFailed(true)
    } finally {
      if (!controller.signal.aborted) setIsResolving(false)
    }
  }, [playId])

  const handlePlaybackFailure = useCallback(() => {
    if (retryStatusRef.current === 'retrying') return
    if (retryAttempt >= MAX_RETRY_ATTEMPTS || !resolvedPlayback) {
      setRetryStatus('exhausted')
      retryStatusRef.current = 'exhausted'
      setResolveFailed(true)
      return
    }

    const candidate = `${resolvedPlayback.provider}:${resolvedPlayback.server ?? 'default'}`
    const newExcludedList = Array.from(new Set([...excludedCandidates, candidate]))
    setExcludedCandidates(newExcludedList)
    setRetryAttempt((attempt) => attempt + 1)
    setRetryStatus('retrying')
    retryStatusRef.current = 'retrying'
    hlsInstanceRef.current?.destroy()
    hlsInstanceRef.current = null
    destroyPlayer()
    resolvePlayback(newExcludedList)
  }, [destroyPlayer, excludedCandidates, resolvePlayback, resolvedPlayback, retryAttempt])

  useEffect(() => {
    const normalizedPlayId = playId?.trim()
    destroyPlayer()
    setExcludedCandidates([])
    setRetryAttempt(0)
    setRetryStatus('idle')
    retryStatusRef.current = 'idle'
    setResolvedPlayback(null)
    setResolveFailed(false)
    setIsPlaying(false)
    if (!normalizedPlayId) {
      setIsResolving(false)
      return
    }
    resolvePlayback([])
  }, [destroyPlayer, playId, resolvePlayback])

  const sourceUrl = resolvedPlayback?.streamUrl ?? videoUrl
  const sourceType = resolvedPlayback?.type ?? 'mp4'
  const sourceIsHls = Boolean(sourceUrl && isHlsStream(sourceUrl, sourceType))

  useEffect(() => {
    let cancelled = false
    if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current)

    if (!isPlaying || !sourceUrl || !sourceIsHls || !videoRef.current) {
      hlsInstanceRef.current?.destroy()
      hlsInstanceRef.current = null
      setHlsMode(sourceIsHls ? 'pending' : 'native')
      if (isPlaying && sourceUrl && videoRef.current) {
        const generation = sourceGenerationRef.current
        playbackTimeoutRef.current = setTimeout(() => {
          const readyState = videoRef.current?.readyState ?? 0
          if (!cancelled && generation === sourceGenerationRef.current && readyState <= 1) handlePlaybackFailure()
        }, 12000)
      }
      return () => {
        cancelled = true
        if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current)
      }
    }

    const video = videoRef.current
    const clearPlaybackTimeout = () => {
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current)
    }
    video.addEventListener('canplay', clearPlaybackTimeout)
    video.addEventListener('loadeddata', clearPlaybackTimeout)
    const generation = sourceGenerationRef.current
    playbackTimeoutRef.current = setTimeout(() => {
      if (generation === sourceGenerationRef.current && video.readyState <= 1) handlePlaybackFailure()
    }, 12000)

    const nativeHlsSupported = video.canPlayType('application/vnd.apple.mpegurl') !== ''
    if (nativeHlsSupported) {
      setHlsMode('native')
      return () => {
        cancelled = true
        clearPlaybackTimeout()
        video.removeEventListener('canplay', clearPlaybackTimeout)
        video.removeEventListener('loadeddata', clearPlaybackTimeout)
        hlsInstanceRef.current?.destroy()
        hlsInstanceRef.current = null
      }
    }

    setHlsMode('pending')
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (!Hls.isSupported()) {
        setHlsMode('fallback')
        return
      }

      const hls = new Hls()
      hlsInstanceRef.current = hls
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) handlePlaybackFailure()
      })
      hls.loadSource(sourceUrl)
      hls.attachMedia(video)
      setHlsMode('hls')
    }).catch((error) => {
      if (!cancelled) {
        console.error('Failed to initialize HLS playback', error)
        setHlsMode('fallback')
      }
    })

    return () => {
      cancelled = true
      clearPlaybackTimeout()
      video.removeEventListener('canplay', clearPlaybackTimeout)
      video.removeEventListener('loadeddata', clearPlaybackTimeout)
      hlsInstanceRef.current?.destroy()
      hlsInstanceRef.current = null
    }
  }, [handlePlaybackFailure, isPlaying, sourceIsHls, sourceUrl])

  useEffect(() => {
    // Only initialize Plyr when user clicks play
    if (isPlaying && videoRef.current && !playerRef.current) {
      // Wait a tick to ensure the video element is fully ready with tracks
      plyrInitTimeoutRef.current = setTimeout(() => {
        plyrInitTimeoutRef.current = null
        if (videoRef.current && !playerRef.current) {
          playerRef.current = new Plyr(videoRef.current, {
    controls: [
      'play-large',
      'play',
      'progress',
      'current-time',
      'mute',
      'volume',
      'captions',
      'settings',
      'fullscreen',
    ],

    settings: ['speed', 'captions'],

    speed: {
      selected: 1,
      options: [0.5, 0.75, 1, 1.25, 1.5, 2],
    },

    captions: {
      active: false,
      language: 'en',
    },
  } as any)
        }
      }, 0)
    }

    return destroyPlayer
  }, [destroyPlayer, isPlaying])

  const handlePlayClick = () => {
    setIsPlaying(true)
  }

  const hasPlayId = Boolean(playId?.trim())

  if (hasPlayId && isResolving) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center bg-black" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
        {retryStatus === 'retrying' && <span className="mt-2 text-sm text-white">Trying another server...</span>}
      </div>
    )
  }

  if (hasPlayId && resolveFailed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-black px-6 text-center text-sm text-white">
        This episode is currently unavailable
      </div>
    )
  }

  if (isPlaying) {
    const trackUrl = resolvedPlayback?.subtitleUrl ?? subtitlesUrl
    const shouldRenderSource = !sourceIsHls || hlsMode === 'native' || hlsMode === 'fallback'

    return (
      <div className="w-full bg-black">
        <video
          ref={videoRef}
          preload="metadata"
          poster={thumbnailUrl}
          playsInline
          className="h-auto w-full plyr-react"
          title={title}
          crossOrigin="anonymous"
          onError={handlePlaybackFailure}
        >
          {shouldRenderSource && (
            <source
              src={sourceUrl ?? undefined}
              type={sourceIsHls ? undefined : 'video/mp4'}
            />
          )}
          {trackUrl && (
            <track
              kind="captions"
              src={trackUrl ?? undefined}
              srcLang="en"
              label="English"
              default
            />
          )}
          Your browser does not support the video tag.
        </video>
      </div>
    )
  }

  return (
    <div
      className="relative w-full cursor-pointer bg-black"
      style={{ aspectRatio: '16 / 9' }}
      onClick={handlePlayClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handlePlayClick()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Play video: ${title}`}
    >
      {/* Poster Image */}
      <Image
        src={thumbnailUrl}
        alt={title}
        fill
        className="object-cover"
        priority
      />

      {/* Play Button Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-all hover:bg-black/40">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/70 shadow-lg transition-transform hover:scale-110">
          <Play className="h-8 w-8 fill-white text-white ml-1" />
        </div>
      </div>
    </div>
  )
}
