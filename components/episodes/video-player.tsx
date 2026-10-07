'use client'

import { useEffect, useRef, useState } from 'react'
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
}

function isHlsStream(url: string, type: string): boolean {
  try {
    return type === 'hls' || /\.m3u8$/i.test(new URL(url, window.location.origin).pathname)
  } catch {
    return type === 'hls' || /\.m3u8(?:$|[?#])/i.test(url)
  }
}

const PLAY_RESOLVE_BASE_URL = 'https://play.otakunaija.name.ng'

export function VideoPlayer({ videoUrl, thumbnailUrl, title, subtitlesUrl, playId }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [resolvedPlayback, setResolvedPlayback] = useState<ResolvedPlayback | null>(null)
  const [isResolving, setIsResolving] = useState(Boolean(playId?.trim()))
  const [resolveFailed, setResolveFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Plyr | null>(null)
  const hlsInstanceRef = useRef<import('hls.js').default | null>(null)
  const [hlsMode, setHlsMode] = useState<'pending' | 'native' | 'hls' | 'fallback'>('pending')

  useEffect(() => {
    const normalizedPlayId = playId?.trim()
    if (!normalizedPlayId) {
      setIsResolving(false)
      setResolvedPlayback(null)
      setResolveFailed(false)
      return
    }

    const controller = new AbortController()
    setIsResolving(true)
    setResolvedPlayback(null)
    setResolveFailed(false)
    setIsPlaying(false)

    fetch(`${PLAY_RESOLVE_BASE_URL}/api/watch/${encodeURIComponent(normalizedPlayId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Playback resolution failed: ${response.status}`)
        const data = await response.json()
        if (typeof data.streamUrl !== 'string' || !data.streamUrl) throw new Error('Missing stream URL')
        const subtitles = Array.isArray(data.subtitles) ? data.subtitles : []
        const subtitle = subtitles.find((track: { default?: boolean }) => track.default) ?? subtitles[0]
        const rawSubtitleUrl = typeof subtitle?.url === 'string' ? subtitle.url : null
        setResolvedPlayback({
          streamUrl: data.streamUrl.startsWith('http')
            ? data.streamUrl
            : `${PLAY_RESOLVE_BASE_URL}${data.streamUrl}`,
          subtitleUrl: rawSubtitleUrl
            ? rawSubtitleUrl.startsWith('http')
              ? rawSubtitleUrl
              : `${PLAY_RESOLVE_BASE_URL}${rawSubtitleUrl}`
            : null,
          type: typeof data.type === 'string' ? data.type : 'mp4',
        })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Failed to resolve episode playback', error)
        setResolveFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsResolving(false)
      })

    return () => controller.abort()
  }, [playId])

  const sourceUrl = resolvedPlayback?.streamUrl ?? videoUrl
  const sourceType = resolvedPlayback?.type ?? 'mp4'
  const sourceIsHls = Boolean(sourceUrl && isHlsStream(sourceUrl, sourceType))

  useEffect(() => {
    let cancelled = false

    if (!isPlaying || !sourceUrl || !sourceIsHls || !videoRef.current) {
      hlsInstanceRef.current?.destroy()
      hlsInstanceRef.current = null
      setHlsMode(sourceIsHls ? 'pending' : 'native')
      return
    }

    const video = videoRef.current
    const nativeHlsSupported = video.canPlayType('application/vnd.apple.mpegurl') !== ''
    if (nativeHlsSupported) {
      setHlsMode('native')
      return () => {
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
      hlsInstanceRef.current?.destroy()
      hlsInstanceRef.current = null
    }
  }, [isPlaying, sourceIsHls, sourceUrl])

  useEffect(() => {
    // Only initialize Plyr when user clicks play
    if (isPlaying && videoRef.current && !playerRef.current) {
      // Wait a tick to ensure the video element is fully ready with tracks
      setTimeout(() => {
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

          // Add custom CSS variables for theming to match dark theme
          const style = document.createElement('style')
          style.textContent = `
            :root {
      --plyr-color-main: var(--color-primary);
      --plyr-control-radius: 0.25rem;
      --plyr-range-track-height: 0.25rem;
    }
            .plyr {
              background-color: #1a0d1a;
            }
            .plyr__controls {
              background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 100%);
            }
            @media (max-width: 640px) {
              .plyr__controls { flex-wrap: wrap; gap: 2px; }
              .plyr__progress { order: -1; flex: 1 0 100%; width: 100%; margin: 0 0 6px 0; min-width: 0; }
              .plyr__volume { display: none; }
              .plyr__controls > button { margin: 0; padding: 6px; }
              .plyr__time { margin: 0 2px; }
            }
          `
          document.head.appendChild(style)
        }
      }, 0)
    }

    return () => {
      // Clean up Plyr instance when component unmounts
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [isPlaying])

  const handlePlayClick = () => {
    setIsPlaying(true)
  }

  const hasPlayId = Boolean(playId?.trim())

  if (hasPlayId && isResolving) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-black" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
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
