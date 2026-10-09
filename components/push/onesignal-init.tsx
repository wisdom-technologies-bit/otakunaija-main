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
        const isPushDebug = new URLSearchParams(window.location.search).get("pushdebug") === "1"
        if (isPushDebug) OneSignal.Debug.setLogLevel("trace")

        await OneSignal.init({
          appId,
          serviceWorkerUpdaterPath: "push/onesignal/OneSignalSDKUpdaterWorker.js",
          serviceWorkerParam: { scope: "/push/onesignal/" },
          allowLocalhostAsSecureOrigin: true,
          promptOptions: { slidedown: { prompts: [] } },
        })

        if (isPushDebug) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          console.log("[pushdebug]", {
            notificationPermission: Notification.permission,
            oneSignalPermission: OneSignal.Notifications.permission,
            optedIn: OneSignal.User.PushSubscription.optedIn,
            serviceWorkerScopes: registrations.map((registration) => registration.scope),
          })
        }

        await new Promise((resolve) => setTimeout(resolve, 20_000))

        if (
          OneSignal.Notifications.permission === false &&
          Notification.permission === "default"
        ) {
          await OneSignal.Notifications.requestPermission()
        }
      } catch {
        // Push setup is optional and must never affect rendering.
      }
    })()
  }, [])

  return null
}
