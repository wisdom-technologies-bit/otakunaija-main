"use client"

import { useEffect } from "react"
import OneSignal from "react-onesignal"

let hasInitialized = false

const notifSupported = () => typeof window !== "undefined" && "Notification" in window
const notifPermission = () => (notifSupported() ? window.Notification.permission : "unsupported")

export function OneSignalInit() {
  useEffect(() => {
    if (!notifSupported() || window.location.pathname.startsWith("/admin")) return
    if (hasInitialized) return
    hasInitialized = true

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId) return

    void (async () => {
      try {
        const isPushDebug = new URLSearchParams(window.location.search).get("pushdebug") === "1"
        if (isPushDebug) OneSignal.Debug.setLogLevel("trace")

        await OneSignal.init({
          appId,
          serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerUpdaterPath: "push/onesignal/OneSignalSDKUpdaterWorker.js",
          serviceWorkerParam: { scope: "/push/onesignal/" },
          allowLocalhostAsSecureOrigin: true,
          promptOptions: { slidedown: { prompts: [] } },
        })

        if (isPushDebug) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          console.log("[pushdebug]", {
            notificationPermission: notifPermission(),
            oneSignalPermission: OneSignal.Notifications.permission,
            optedIn: OneSignal.User.PushSubscription.optedIn,
            serviceWorkerScopes: registrations.map((registration) => registration.scope),
          })
        }

      } catch {
        // Push setup is optional and must never affect rendering.
      }
    })()
  }, [])

  return null
}
