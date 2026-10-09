"use client"

import { useEffect } from "react"
import OneSignal from "react-onesignal"

let hasInitialized = false

export function OneSignalInit() {
  useEffect(() => {
    if (hasInitialized || window.location.pathname.startsWith("/admin")) return
    hasInitialized = true

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId) return

    void (async () => {
      try {
        await OneSignal.init({
          appId,
          serviceWorkerUpdaterPath: "push/onesignal/OneSignalSDKUpdaterWorker.js",
          serviceWorkerParam: { scope: "/push/onesignal/" },
          allowLocalhostAsSecureOrigin: true,
        })

        await new Promise((resolve) => setTimeout(resolve, 20_000))

        if (OneSignal.Notifications.permission === false) {
          await OneSignal.Notifications.requestPermission()
        }
      } catch {
        // Push setup is optional and must never affect rendering.
      }
    })()
  }, [])

  return null
}
