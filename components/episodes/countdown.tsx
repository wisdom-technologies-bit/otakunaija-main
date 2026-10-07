'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

function Tile({ value, label, urgent }: { value: number; label: string; urgent: boolean }) {
  return <span className={`flex min-w-0 flex-1 flex-col items-center rounded-md border bg-black/25 px-1 py-1 ${urgent ? 'border-primary text-primary' : 'border-amber-500/70 text-amber-400'}`}><strong className="text-xs font-bold tabular-nums">{String(value).padStart(2, '0')}</strong><small className="text-[8px] text-muted-foreground">{label}</small></span>
}

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

  if (!mounted || remaining === null) return <span className="flex w-full gap-1"><span className="h-8 flex-1 rounded-md border border-amber-500/70 bg-black/25" /><span className="h-8 flex-1 rounded-md border border-amber-500/70 bg-black/25" /><span className="h-8 flex-1 rounded-md border border-amber-500/70 bg-black/25" /></span>
  if (remaining <= 0) return <span className="text-xs font-semibold text-primary">Releasing now</span>

  const total = Math.floor(remaining / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const urgent = total < 3600
  return <span className="flex w-full gap-1">{days > 0 && <Tile value={days} label="DAY" urgent={urgent} />}<Tile value={hours} label="HRS" urgent={urgent} /><Tile value={minutes} label="MIN" urgent={urgent} /><Tile value={seconds} label="SEC" urgent={urgent} /></span>
}

export default Countdown
