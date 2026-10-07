'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function Countdown({ releaseAt }: { releaseAt: string }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [refreshed, setRefreshed] = useState(false)

  useEffect(() => {
    setMounted(true)
    const update = () => setRemaining(new Date(releaseAt).getTime() - Date.now())
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [releaseAt])

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !refreshed) {
      setRefreshed(true)
      router.refresh()
    }
  }, [remaining, refreshed, router])

  if (!mounted || remaining === null) return <span className="inline-block w-[5.5rem] tabular-nums">--</span>
  if (remaining <= 0) return <span className="tabular-nums">Releasing now</span>

  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const text = days > 0 ? `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m` : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return <span className="tabular-nums">{text}</span>
}
