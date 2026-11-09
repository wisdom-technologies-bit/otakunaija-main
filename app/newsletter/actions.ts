"use server"

import { redirect } from "next/navigation"
import { unsubscribeByToken, updatePreferencesByToken } from "@/lib/newsletter/subscribe"
import { subscribeStore } from "@/lib/newsletter/runtime"
import { normalisePrefs } from "@/lib/newsletter/types"

function tokenFrom(formData: FormData): string {
  return String(formData.get("token") ?? "").trim()
}

export async function savePreferencesAction(formData: FormData): Promise<void> {
  const token = tokenFrom(formData)
  if (!token) redirect("/newsletter/preferences?error=missing-token")

  const prefs = normalisePrefs({
    news: formData.get("news") === "on",
    episodes: formData.get("episodes") === "on",
    upcoming: formData.get("upcoming") === "on",
    frequency: formData.get("frequency") === "weekly" ? "weekly" : "daily",
  })

  const result = await updatePreferencesByToken(token, prefs, { store: subscribeStore })
  if (!result.ok) redirect(`/newsletter/preferences?error=invalid-token`)

  redirect(`/newsletter/preferences?token=${encodeURIComponent(token)}&saved=1`)
}

export async function unsubscribeAction(formData: FormData): Promise<void> {
  const token = tokenFrom(formData)
  const reason = String(formData.get("reason") ?? "").trim() || null
  if (!token) redirect("/newsletter/unsubscribe?error=missing-token")

  const result = await unsubscribeByToken(token, reason, { store: subscribeStore, now: new Date() })
  if (!result.ok) redirect(`/newsletter/unsubscribe?error=invalid-token`)

  redirect(`/newsletter/unsubscribe?token=${encodeURIComponent(token)}&done=1`)
}
