"use client"

import { useEffect, useState } from "react"
import OneSignal from "react-onesignal"

const DISMISSED_KEY = "push-notifications-dismissed"
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000

export function EnableNotifications() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (
      window.location.pathname.startsWith("/admin") ||
      (/(iPhone|iPad|iPod)/i.test(navigator.userAgent) &&
        !window.matchMedia("(display-mode: standalone)").matches)
    ) {
      return
    }

    try {
      const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY))
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_DURATION) return
    } catch {
      // Local storage is optional.
    }

    let cancelled = false
    const checkPermission = () => {
      if (cancelled) return
      const browserPermission = Notification.permission
      const optedIn = OneSignal.User.PushSubscription.optedIn
      setVisible(browserPermission === "default" || (browserPermission === "granted" && optedIn === false))
    }

    const interval = window.setInterval(checkPermission, 500)
    checkPermission()
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  if (!visible) return null

  const handleEnable = async () => {
    setVisible(false)
    try {
      await OneSignal.Notifications.requestPermission()
      if (Notification.permission === "granted") {
        await OneSignal.User.PushSubscription.optIn()
      }
    } catch {
      // Push setup is optional and must never affect rendering.
    }
  }

  const handleDismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {
      // Local storage is optional.
    }
  }

  return (
    <aside className="mx-auto mt-8 flex max-w-xl items-center gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm" aria-label="Enable notifications">
      <p className="min-w-0 flex-1 text-sm font-medium">Get alerts for new episodes and posts</p>
      <button type="button" onClick={handleEnable} className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
        Enable
      </button>
      <button type="button" onClick={handleDismiss} className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Dismiss notifications">
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  )
}
