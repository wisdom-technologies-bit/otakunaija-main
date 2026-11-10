'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Share2 } from 'lucide-react'

type ShareButtonProps = {
  /** Absolute or root-relative URL to share. Resolved against the origin at click time. */
  url: string
  title: string
  label?: string
  className?: string
}

/**
 * Share, via the Web Share API when the device has one and the clipboard
 * otherwise. Never invents a share sheet: a denied/absent clipboard says so
 * instead of pretending it worked.
 */
export function ShareButton({ url, title, label = 'Share', className = '' }: ShareButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const absolute = () =>
    typeof window === 'undefined' ? url : new URL(url, window.location.origin).toString()

  const flash = (next: 'copied' | 'failed') => {
    setState(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2200)
  }

  const share = async () => {
    const href = absolute()
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url: href })
        return
      } catch {
        // Dismissing the sheet is not an error, but a failed share can be
        // retried through the clipboard below.
      }
    }
    try {
      await navigator.clipboard.writeText(href)
      flash('copied')
    } catch {
      flash('failed')
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={`otk-btn otk-btn-quiet otk-focus ${className}`}
      aria-label={state === 'copied' ? 'Link copied' : label}
      data-testid="share-button"
    >
      {state === 'copied' ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      <span>{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}</span>
    </button>
  )
}

export default ShareButton
