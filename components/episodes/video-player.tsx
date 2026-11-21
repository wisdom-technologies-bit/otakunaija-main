'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Loader2, Play, RotateCcw } from 'lucide-react'
import * as PlyrModule from 'plyr'

const Plyr = PlyrModule.default
import 'plyr/dist/plyr.css'

import {
  buildHlsConfig,
  choosePlaybackMode,
  type PlaybackMode,
} from '@/lib/player/playback-strategy'
import {
  describeHlsError,
  describeMediaError,
  describeResolveStatus,
  describeTimeout,
  logPlayerEvent,
  overlayMessage,
  recentPlayerEvents,
  redactUrl,
  resetPlayerEvents,
  subscribePlayerEvents,
  type PlayerCode,
  type PlayerEvent,
  type PlayerFailure,
} from '@/lib/player/diagnostics'
import { StartWatchdog } from '@/lib/player/start-watchdog'
import { STALL_GRACE_MS, describeBufferStall, isBufferStall } from '@/lib/player/buffer-stall'

interface VideoPlayerProps {
  videoUrl: string | null
  thumbnailUrl: string
  title: string
  subtitlesUrl?: string | null
  playId?: string | null
  nextEpisode?: {
    slug: string
    seriesSlug: string
    episodeNumber: number
    title: string
  } | null
}

interface ResolvedSubtitle {
  url: string
  srclang: string
  label: string
  default: boolean
}

interface ResolvedPlayback {
  streamUrl: string
  subtitleUrl: string | null
  subtitles: ResolvedSubtitle[]
  intro: { start: number; end: number } | null
  outro: { start: number; end: number } | null
  type: string
  provider: string
  server: string | null
}

/** Plyr's constructor type is a namespace in its own typings; only destroy is used. */
type PlyrInstance = { destroy: () => void }

function isHlsStream(url: string, type: string): boolean {
  try {
    return type === 'hls' || /\.m3u8$/i.test(new URL(url, window.location.origin).pathname)
  } catch {
    return type === 'hls' || /\.m3u8(?:$|[?#])/i.test(url)
  }
}

const PLAY_RESOLVE_BASE_URL = 'https://play.otakunaija.name.ng'
const MAX_RETRY_ATTEMPTS = 4
/** A resolve that never answers is a spinner forever; the old code had no limit. */
const RESOLVE_TIMEOUT_MS = 30_000

export function VideoPlayer({ videoUrl, thumbnailUrl, title, subtitlesUrl, playId, nextEpisode = null }: VideoPlayerProps) {
  const router = useRouter()
  const [isPlaying, setIsPlaying] = useState(false)
  const [showNextEpisodeOverlay, setShowNextEpisodeOverlay] = useState(false)
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(5)
  const [showSkipIntro, setShowSkipIntro] = useState(false)
  const [showSkipOutro, setShowSkipOutro] = useState(false)
  const [resolvedPlayback, setResolvedPlayback] = useState<ResolvedPlayback | null>(null)
  const [isResolving, setIsResolving] = useState(Boolean(playId?.trim()))
  const [failure, setFailure] = useState<(PlayerFailure & { detail?: string }) | null>(null)
  const [excludedCandidates, setExcludedCandidates] = useState<string[]>([])
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [retryStatus, setRetryStatus] = useState<'idle' | 'retrying' | 'exhausted'>('idle')
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode | null>(null)
  const [debugEvents, setDebugEvents] = useState<PlayerEvent[]>([])
  const [debugEnabled, setDebugEnabled] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<PlyrInstance | null>(null)
  const hlsInstanceRef = useRef<import('hls.js').default | null>(null)
  const retryStatusRef = useRef(retryStatus)
  const plyrInitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextEpisodeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sourceGenerationRef = useRef(0)
  /** The fragment in flight, kept for a stall report. Redacted when reported. */
  const lastFragmentUrlRef = useRef<string | null>(null)
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [playerEpoch, setPlayerEpoch] = useState(0)
  /** Set once, when the native path fails and hls.js is available to take over. */
  const [forceHls, setForceHls] = useState(false)

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

  useEffect(() => {
    setDebugEnabled(new URLSearchParams(window.location.search).get('debug') === '1')
    return subscribePlayerEvents(setDebugEvents)
  }, [])

  const clearNextEpisodeInterval = useCallback(() => {
    if (nextEpisodeIntervalRef.current) {
      clearInterval(nextEpisodeIntervalRef.current)
      nextEpisodeIntervalRef.current = null
    }
  }, [])

  const navigateToNextEpisode = useCallback(() => {
    if (!nextEpisode) return
    clearNextEpisodeInterval()
    setShowNextEpisodeOverlay(false)
    router.push(`/episodes/${nextEpisode.seriesSlug}/${nextEpisode.slug}`)
  }, [clearNextEpisodeInterval, nextEpisode, router])

  useEffect(() => {
    clearNextEpisodeInterval()
    setShowNextEpisodeOverlay(false)
    setNextEpisodeCountdown(5)

    return clearNextEpisodeInterval
  }, [clearNextEpisodeInterval, nextEpisode])

  const handleVideoEnded = () => {
    if (!nextEpisode) return
    clearNextEpisodeInterval()
    setNextEpisodeCountdown(5)
    setShowNextEpisodeOverlay(true)
    nextEpisodeIntervalRef.current = setInterval(() => {
      setNextEpisodeCountdown((countdown) => {
        if (countdown <= 1) {
          navigateToNextEpisode()
          return 0
        }
        return countdown - 1
      })
    }, 1000)
  }

  const fail = useCallback((next: PlayerFailure & { detail?: string }) => {
    logPlayerEvent(next.code, next.detail ?? '')
    setFailure(next)
  }, [])

  const resolvePlayback = useCallback(async (excludeList: string[], attempt = 0) => {
    const normalizedPlayId = playId?.trim()
    if (!normalizedPlayId) return

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS)

    // Clean up third-party DOM mutations before React changes the player state.
    // This prevents Plyr from trying to remove nodes React has already detached.
    hlsInstanceRef.current?.destroy()
    hlsInstanceRef.current = null
    setIsResolving(true)
    try {
      const query = excludeList.length ? `?exclude=${encodeURIComponent(excludeList.join(','))}` : ''
      const response = await fetch(
        `${PLAY_RESOLVE_BASE_URL}/api/watch/${encodeURIComponent(normalizedPlayId)}${query}`,
        { signal: controller.signal },
      )
      if (!response.ok) {
        let bodyError = ''
        try {
          const body: unknown = await response.json()
          if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
            bodyError = (body as { error: string }).error
          }
        } catch {
          // A non-JSON error page (an edge 5xx) is still an error status.
        }
        const next = describeResolveStatus(response.status, bodyError)
        fail({ ...next, detail: `playId=${normalizedPlayId} status=${response.status}${bodyError ? ` error=${bodyError}` : ''}` })
        setFailure({ ...next, detail: bodyError })
        if (next.retryable && attempt < MAX_RETRY_ATTEMPTS) {
          setRetryStatus('exhausted')
          retryStatusRef.current = 'exhausted'
        }
        return
      }
      const data = await response.json()
      if (typeof data.streamUrl !== 'string' || !data.streamUrl) {
        const provider = typeof data.provider === 'string' ? data.provider : ''
        const server = typeof data.server === 'string' ? data.server : ''
        const candidate = provider ? `${provider}:${server || 'default'}` : null
        const nextExcludedList = candidate
          ? Array.from(new Set([...excludeList, candidate]))
          : excludeList

        if (candidate && nextExcludedList.length > excludeList.length && attempt < MAX_RETRY_ATTEMPTS) {
          setExcludedCandidates(nextExcludedList)
          setRetryAttempt(attempt + 1)
          setRetryStatus('retrying')
          retryStatusRef.current = 'retrying'
          await resolvePlayback(nextExcludedList, attempt + 1)
          return
        }

        fail({
          code: 'PLAY_NO_STREAM_URL',
          message: 'The play service returned no stream',
          retryable: attempt < MAX_RETRY_ATTEMPTS,
          detail: `playId=${normalizedPlayId} provider=${provider || 'none'}`,
        })
        return
      }
      const subtitles: ResolvedSubtitle[] = Array.isArray(data.subtitles)
        ? data.subtitles.flatMap((track: { url?: unknown; srclang?: unknown; label?: unknown; default?: unknown }) => {
            if (typeof track.url !== 'string' || !track.url) return []
            return [{
              url: track.url,
              srclang: typeof track.srclang === 'string' && track.srclang ? track.srclang : 'en',
              label: typeof track.label === 'string' && track.label ? track.label : 'English',
              default: track.default === true,
            }]
          })
        : []
      const subtitle = subtitles.find((track) => track.default) ?? subtitles[0]
      const rawSubtitleUrl = typeof subtitle?.url === 'string' ? subtitle.url : null
      const normalizeRange = (range: unknown) => {
        if (!range || typeof range !== 'object') return null
        const candidate = range as { start?: unknown; end?: unknown }
        return typeof candidate.start === 'number' && typeof candidate.end === 'number'
          ? { start: candidate.start, end: candidate.end }
          : null
      }

      setShowSkipIntro(false)
      setShowSkipOutro(false)

      sourceGenerationRef.current += 1
      setPlayerEpoch((epoch) => epoch + 1)
      const provider = typeof data.provider === 'string' ? data.provider : ''
      const server = typeof data.server === 'string' ? data.server : null
      logPlayerEvent('PLAY_RESOLVE_OK', `provider=${provider || 'unknown'} server=${server ?? 'default'} type=${typeof data.type === 'string' ? data.type : 'mp4'}`)
      setResolvedPlayback({
        streamUrl: data.streamUrl.startsWith('http') ? data.streamUrl : `${PLAY_RESOLVE_BASE_URL}${data.streamUrl}`,
        subtitleUrl: rawSubtitleUrl
          ? rawSubtitleUrl.startsWith('http') ? rawSubtitleUrl : `${PLAY_RESOLVE_BASE_URL}${rawSubtitleUrl}`
          : null,
        subtitles: subtitles.map((track) => ({
          ...track,
          url: track.url.startsWith('http') ? track.url : `${PLAY_RESOLVE_BASE_URL}${track.url}`,
        })),
        intro: normalizeRange(data.intro),
        outro: normalizeRange(data.outro),
        type: typeof data.type === 'string' ? data.type : 'mp4',
        provider,
        server,
      })
      setFailure(null)
      setRetryStatus('idle')
      retryStatusRef.current = 'idle'
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        fail({
          code: 'PLAY_RESOLVE_TIMEOUT',
          message: 'The play service did not answer',
          retryable: true,
          detail: `playId=${normalizedPlayId} after ${RESOLVE_TIMEOUT_MS}ms`,
        })
        return
      }
      // A rejected fetch is what the browser reports for CORS, DNS and offline.
      // It carries no status, which is exactly why it needs its own code.
      fail({
        code: 'PLAY_RESOLVE_NETWORK',
        message: 'Could not reach the play service',
        retryable: true,
        detail: `playId=${normalizedPlayId} ${error instanceof Error ? error.name : 'unknown'}`,
      })
    } finally {
      clearTimeout(timer)
      setIsResolving(false)
    }
  }, [fail, playId])

  const handlePlaybackFailure = useCallback((next: PlayerFailure & { detail?: string }) => {
    if (retryStatusRef.current === 'retrying') return
    fail(next)

    if (!next.retryable || retryAttempt >= MAX_RETRY_ATTEMPTS || !resolvedPlayback) {
      setRetryStatus('exhausted')
      retryStatusRef.current = 'exhausted'
      logPlayerEvent('PLAYER_EXHAUSTED', `${next.code} attempts=${retryAttempt}`)
      return
    }

    const candidate = `${resolvedPlayback.provider}:${resolvedPlayback.server ?? 'default'}`
    const newExcludedList = Array.from(new Set([...excludedCandidates, candidate]))
    setExcludedCandidates(newExcludedList)
    setRetryAttempt(retryAttempt + 1)
    setRetryStatus('retrying')
    retryStatusRef.current = 'retrying'
    hlsInstanceRef.current?.destroy()
    hlsInstanceRef.current = null
    resolvePlayback(newExcludedList, retryAttempt + 1)
  }, [excludedCandidates, fail, resolvePlayback, resolvedPlayback, retryAttempt])

  useEffect(() => {
    const normalizedPlayId = playId?.trim()
    destroyPlayer()
    resetPlayerEvents()
    setExcludedCandidates([])
    setRetryAttempt(0)
    setRetryStatus('idle')
    retryStatusRef.current = 'idle'
    setResolvedPlayback(null)
    setFailure(null)
    setIsPlaying(false)
    setForceHls(false)
    setPlaybackMode(null)
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
    let watchdog: StartWatchdog | null = null
    const detach: Array<() => void> = []

    hlsInstanceRef.current?.destroy()
    hlsInstanceRef.current = null

    const cleanup = () => {
      cancelled = true
      watchdog?.cancel()
      watchdog = null
      for (const off of detach) off()
    }

    if (!isPlaying || !sourceUrl || !videoRef.current) return cleanup

    const video = videoRef.current
    const generation = sourceGenerationRef.current
    const alive = () => !cancelled && generation === sourceGenerationRef.current

    const watch = (onExpire: (reason: 'no-fragment' | 'no-progress' | 'hard-cap') => void) => {
      const instance = new StartWatchdog({
        onExpire: (reason) => {
          if (alive()) onExpire(reason)
        },
      })
      watchdog = instance
      return instance
    }

    // A progressive file needs no hls.js: the <source> below is enough.
    if (!sourceIsHls) {
      setPlaybackMode('native')
      const instance = watch((reason) => handlePlaybackFailure(describeTimeout(reason)))
      const ready = () => instance.notePlaying()
      video.addEventListener('canplay', ready)
      video.addEventListener('loadeddata', ready)
      detach.push(() => {
        video.removeEventListener('canplay', ready)
        video.removeEventListener('loadeddata', ready)
      })
      instance.start()
      return cleanup
    }

    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !alive()) return

      const nativeSupport = video.canPlayType('application/vnd.apple.mpegurl')
      const decision = forceHls
        ? { mode: 'hlsjs' as PlaybackMode, reason: 'forced-after-native-error', userAgentClass: 'unknown' as const }
        : choosePlaybackMode({
            nativeHlsSupport: nativeSupport,
            hlsJsSupported: Hls.isSupported(),
            userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
          })
      // The one line that makes a phone screenshot diagnosable.
      logPlayerEvent(
        'PLAYER_MODE',
        `${decision.mode} reason=${decision.reason} canPlayType=${nativeSupport || 'empty'} mse=${Hls.isSupported()}`,
      )
      setPlaybackMode(decision.mode)

      if (decision.mode === 'native') {
        // No MSE: the browser's own HLS player is the only option. Its failures
        // used to surface as a silent 12 s timeout; now they carry a code.
        const instance = watch((reason) => handlePlaybackFailure(describeTimeout(reason)))
        const ready = () => instance.notePlaying()
        const onError = () => {
          if (!alive()) return
          instance.cancel()
          handlePlaybackFailure(describeMediaError(video.error))
        }
        video.addEventListener('canplay', ready)
        video.addEventListener('loadeddata', ready)
        video.addEventListener('error', onError)
        detach.push(() => {
          video.removeEventListener('canplay', ready)
          video.removeEventListener('loadeddata', ready)
          video.removeEventListener('error', onError)
        })
        instance.start()
        return
      }

      if (decision.mode === 'fallback' || !Hls.isSupported()) {
        setPlaybackMode('fallback')
        return
      }

      const hls = new Hls(buildHlsConfig())
      hlsInstanceRef.current = hls
      const instance = watch((reason) => handlePlaybackFailure(describeTimeout(reason)))
      let recoveredMedia = false

      hls.on(Hls.Events.MANIFEST_LOADED, () => instance.noteManifestLoaded())
      const clearStallTimer = () => {
        if (stallTimerRef.current) {
          clearTimeout(stallTimerRef.current)
          stallTimerRef.current = null
        }
      }

      hls.on(Hls.Events.MANIFEST_PARSED, () => instance.noteManifestLoaded())
      hls.on(Hls.Events.FRAG_LOADING, (_event, data) => {
        instance.noteFragmentLoading()
        const frag = (data as { frag?: { url?: string } } | undefined)?.frag
        lastFragmentUrlRef.current = typeof frag?.url === 'string' ? frag.url : null
      })
      // hls.js 1.7 no longer emits FRAG_LOAD_PROGRESS, so "bytes are still
      // arriving" is read from the media element itself: `buffered.end()` grows
      // as the fragment is appended and is the one progress signal both the
      // hls.js path and the native path share.
      const onProgress = () => {
        // Data is moving again: a stall that was being timed has recovered.
        clearStallTimer()
        const buffered = video.buffered
        instance.noteProgress(buffered.length > 0 ? buffered.end(buffered.length - 1) : video.currentTime)
      }
      video.addEventListener('progress', onProgress)
      hls.on(Hls.Events.FRAG_LOADED, () => {
        clearStallTimer()
        instance.noteProgress(Number.MAX_SAFE_INTEGER)
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        // A buffer stall is not a dead provider: hls.js recovers by itself. It is
        // recorded at once with the fragment that was in flight, and only
        // escalated once it has outlived the watchdog's no-progress budget.
        if (isBufferStall(data.details)) {
          const reported = describeBufferStall({ fragmentUrl: lastFragmentUrlRef.current, stalledForMs: 0 })
          logPlayerEvent(reported.code, reported.detail)
          if (!stallTimerRef.current) {
            const startedAt = Date.now()
            stallTimerRef.current = setTimeout(() => {
              stallTimerRef.current = null
              handlePlaybackFailure(describeBufferStall({
                fragmentUrl: lastFragmentUrlRef.current,
                stalledForMs: Date.now() - startedAt,
              }))
            }, STALL_GRACE_MS)
          }
          return
        }

        const described = describeHlsError(data)
        if (!data.fatal) {
          // Non-fatal noise (a retried fragment, a subtitle track) is recorded
          // but never ends playback.
          logPlayerEvent(described.code, described.detail)
          return
        }
        instance.cancel()
        // One media-error recovery before blaming the provider: a decoder
        // hiccup on a valid segment is not a dead stream.
        if (/mediaError/i.test(String(data.type ?? '')) && !recoveredMedia) {
          recoveredMedia = true
          logPlayerEvent(described.code, `${described.detail} recovering`)
          try {
            hls.recoverMediaError()
            return
          } catch {
            // fall through to the normal failure path
          }
        }
        handlePlaybackFailure(described)
      })

      hls.loadSource(sourceUrl)
      hls.attachMedia(video)
      instance.start()

      detach.push(() => {
        clearStallTimer()
        video.removeEventListener('progress', onProgress)
        hls.destroy()
        if (hlsInstanceRef.current === hls) hlsInstanceRef.current = null
      })
    }).catch(() => {
      if (cancelled) return
      logPlayerEvent('HLS_FATAL_OTHER', 'hls.js chunk failed to load')
      setPlaybackMode('fallback')
    })

    return cleanup
  }, [forceHls, handlePlaybackFailure, isPlaying, sourceIsHls, sourceUrl])

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
      'duration',
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
  }, [destroyPlayer, isPlaying, sourceUrl, playerEpoch])

  const handlePlayClick = () => {
    setIsPlaying(true)
  }

  /** Retry from the overlay: clears every bit of retry state and resolves again. */
  const handleRetry = () => {
    destroyPlayer()
    hlsInstanceRef.current?.destroy()
    hlsInstanceRef.current = null
    setExcludedCandidates([])
    setRetryAttempt(0)
    setRetryStatus('idle')
    retryStatusRef.current = 'idle'
    setResolvedPlayback(null)
    setFailure(null)
    setForceHls(false)
    setPlaybackMode(null)
    setIsPlaying(false)
    resolvePlayback([])
  }

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (!video) return

    const currentTime = video.currentTime
    const intro = resolvedPlayback?.intro
    const outro = resolvedPlayback?.outro

    const validIntro =
      intro &&
      Number.isFinite(intro.start) &&
      Number.isFinite(intro.end) &&
      intro.start >= 0 &&
      intro.end > intro.start

    const validOutro =
      outro &&
      Number.isFinite(outro.start) &&
      Number.isFinite(outro.end) &&
      outro.start >= 0 &&
      outro.end > outro.start

    setShowSkipIntro(
      Boolean(validIntro && currentTime >= intro.start && currentTime < intro.end),
    )

    setShowSkipOutro(
      Boolean(validOutro && currentTime >= outro.start && currentTime < outro.end),
    )
  }

  const handleSkipIntro = () => {
    const video = videoRef.current
    const intro = resolvedPlayback?.intro

    if (!video || !intro) return

    video.currentTime = intro.end
    setShowSkipIntro(false)
    setShowSkipOutro(
      Boolean(
        resolvedPlayback?.outro &&
        intro.end >= resolvedPlayback.outro.start &&
        intro.end < resolvedPlayback.outro.end,
      ),
    )
  }

  const handleSkipOutro = () => {
    const video = videoRef.current
    const outro = resolvedPlayback?.outro

    if (!video || !outro) return

    video.currentTime = outro.end
    setShowSkipOutro(false)
    setShowSkipIntro(false)
  }

  const hasPlayId = Boolean(playId?.trim())

  const debugPanel = debugEnabled ? (
    <div className="pointer-events-none absolute left-2 top-2 z-30 max-w-[min(22rem,90%)] rounded bg-black/80 p-2 font-mono text-[10px] leading-tight text-white/90">
      <div className="mb-1 font-semibold text-white/60">player debug</div>
      {debugEvents.length === 0 && <div className="text-white/50">no events yet</div>}
      {debugEvents.map((event, index) => (
        <div key={`${event.at}-${index}`} className="truncate">
          {event.code}
          {event.detail ? ` ${event.detail}` : ''}
        </div>
      ))}
    </div>
  ) : null

  if (hasPlayId && isResolving && !isPlaying) {
    return (
      <div className="relative">
        {debugPanel}
        <div className="flex aspect-video w-full flex-col items-center justify-center bg-black" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
          {retryStatus === 'retrying' && <span className="mt-2 text-sm text-white">Switching provider...</span>}
        </div>
      </div>
    )
  }

  if (hasPlayId && failure) {
    return (
      <div className="relative">
        {debugPanel}
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-black px-6 text-center text-sm text-white">
          <p>{overlayMessage(failure)}</p>
          <p className="font-mono text-[11px] text-white/60">code: {failure.code}</p>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white/10"
            onClick={handleRetry}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (isPlaying) {
    const trackUrl = resolvedPlayback?.subtitleUrl ?? subtitlesUrl
    const shouldRenderSource = !sourceIsHls || playbackMode === 'native' || playbackMode === 'fallback'

    return (
      <div key="player" className="relative w-full bg-black">
        {debugPanel}
        {hasPlayId && isResolving && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 text-center text-white" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
            <span className="mt-2 text-sm">Switching provider...</span>
          </div>
        )}
        <div key={`${sourceUrl ?? 'no-source'}-${playerEpoch}`}>
        <video
          ref={videoRef}
          preload="metadata"
          poster={thumbnailUrl}
          playsInline
          className="h-auto w-full plyr-react"
          title={title}
          crossOrigin="anonymous"
          onError={() => {
            // The hls.js path reports through Hls.Events.ERROR; only the native
            // path needs the DOM error, otherwise one failure is counted twice.
            if (playbackMode === 'hlsjs') return
            handlePlaybackFailure(describeMediaError(videoRef.current?.error))
          }}
          onEnded={handleVideoEnded}
          onTimeUpdate={handleTimeUpdate}
        >
          {shouldRenderSource && (
            <source
              src={sourceUrl ?? undefined}
              type={sourceIsHls ? undefined : 'video/mp4'}
            />
          )}
          {resolvedPlayback?.subtitles.length
            ? resolvedPlayback.subtitles.map((track) => (
                <track
                  key={`${track.srclang}-${track.label}-${track.url}`}
                  kind="captions"
                  src={track.url}
                  srcLang={track.srclang}
                  label={track.label}
                  default={track.default || !resolvedPlayback.subtitles.some((subtitle) => subtitle.default) && track === resolvedPlayback.subtitles[0]}
                  onError={() => logPlayerEvent('SUBTITLE_LOAD_ERROR', redactUrl(track.url))}
                />
              ))
            : trackUrl && (
                <track
                  kind="captions"
                  src={trackUrl}
                  srcLang="en"
                  label="English"
                  default
                  onError={() => logPlayerEvent('SUBTITLE_LOAD_ERROR', redactUrl(trackUrl))}
                />
              )}
          Your browser does not support the video tag.
        </video>
        </div>
        {showSkipIntro && (
          <button
            type="button"
            className="absolute bottom-16 right-4 rounded-full bg-black/75 px-3 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/90"
            onClick={handleSkipIntro}
          >
            Skip Intro
          </button>
        )}
        {showSkipOutro && (
          <button
            type="button"
            className="absolute bottom-16 right-4 rounded-full bg-black/75 px-3 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/90"
            onClick={handleSkipOutro}
          >
            Skip Outro
          </button>
        )}
        {showNextEpisodeOverlay && nextEpisode && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-white">
            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold">Episode {nextEpisode.episodeNumber} will play in {nextEpisodeCountdown}s</p>
                <p className="mt-1 text-sm text-white/80">{nextEpisode.title}</p>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  className="rounded-md border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white/10"
                  onClick={() => {
                    clearNextEpisodeInterval()
                    setShowNextEpisodeOverlay(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  onClick={navigateToNextEpisode}
                >
                  Play Now
                </button>
              </div>
            </div>
          </div>
        )}
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
      {debugPanel}
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
