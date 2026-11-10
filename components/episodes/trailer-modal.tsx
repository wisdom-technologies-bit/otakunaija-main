'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, X } from 'lucide-react'
import { trailerTarget } from '@/lib/episode-ui'

type TrailerModalProps = {
  site: string | null | undefined
  id: string | null | undefined
  title: string
  className?: string
}

/**
 * Trailer action: an embedded player for YouTube (youtube-nocookie only) and a
 * plain outbound link for anything else. Renders nothing when there is no
 * usable trailer, so pages never show a dead button.
 */
export function TrailerModal({ site, id, title, className = '' }: TrailerModalProps) {
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const target = trailerTarget(site, id)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, close])

  if (!target) return null

  if (target.kind === 'link') {
    return (
      <a
        href={target.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`otk-btn otk-btn-quiet otk-focus ${className}`}
        data-testid="trailer-link"
      >
        <Play className="h-4 w-4" />
        <span>Trailer</span>
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`otk-btn otk-btn-quiet otk-focus ${className}`}
        data-testid="trailer-button"
        aria-haspopup="dialog"
      >
        <Play className="h-4 w-4" />
        <span>Trailer</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} trailer`}
          onClick={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <div className="w-full max-w-3xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-white">{title} — trailer</p>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="otk-focus inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white hover:bg-white/10"
                aria-label="Close trailer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="otk-media otk-media-16x9 overflow-hidden rounded-xl bg-black">
              <iframe
                src={target.url}
                title={`${title} trailer`}
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default TrailerModal
