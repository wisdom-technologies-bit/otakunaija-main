"use client"

import { useEffect, useState } from "react"

const DATE_FORMATTER = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Lagos",
  year: "numeric",
})

function formatRelativeTime(dateString: string) {
  const timestamp = new Date(dateString).getTime()
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function RelativeTime({ date }: { date: string }) {
  const [label, setLabel] = useState(() => DATE_FORMATTER.format(new Date(date)))

  useEffect(() => {
    setLabel(formatRelativeTime(date))
  }, [date])

  return <time dateTime={date} suppressHydrationWarning>{label}</time>
}
