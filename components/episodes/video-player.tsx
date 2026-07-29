'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Play } from 'lucide-react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

interface VideoPlayerProps {
  videoUrl: string
  thumbnailUrl: string
  title: string
  subtitlesUrl?: string | null
}

export function VideoPlayer({ videoUrl, thumbnailUrl, title, subtitlesUrl }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Plyr | null>(null)

  useEffect(() => {
    // Only initialize Plyr when user clicks play
    if (isPlaying && videoRef.current && !playerRef.current) {
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
    'pip',
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
      `
      document.head.appendChild(style)
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

  if (isPlaying) {
    return (
      <div className="w-full bg-black">
        <video
          ref={videoRef}
          preload="none"
          poster={thumbnailUrl}
          playsInline
          className="h-auto w-full plyr-react"
          title={title}
        >
          <source src={videoUrl} type="video/mp4" />
          {subtitlesUrl && (
            <track
              kind="captions"
              src={subtitlesUrl}
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
