"use server"

import { headers } from "next/headers"
import { subscribe } from "@/lib/newsletter/subscribe"
import { signupLimiter, subscribeStore, sendConfirmationEmail } from "@/lib/newsletter/runtime"

export type SubscribeResponse = { ok: boolean; message: string }

/**
 * Double opt-in entry point.
 *
 * `honeypot` is a field bots fill in and people never see; a filled honeypot
 * returns the neutral success message and writes nothing. The address is
 * normalised and validated before any database work, and attempts are limited
 * per IP.
 */
export async function subscribeToNewsletter(
  email: string,
  options: { honeypot?: string; source?: string } = {},
): Promise<SubscribeResponse> {
  const requestHeaders = await headers()
  const forwarded = requestHeaders.get("x-forwarded-for") ?? ""
  const ip = forwarded.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || null

  const result = await subscribe(
    {
      email,
      honeypot: options.honeypot ?? null,
      ip,
      source: options.source ?? "site-form",
    },
    {
      store: subscribeStore,
      sendConfirmation: sendConfirmationEmail,
      limiter: signupLimiter,
      now: new Date(),
    },
  )

  return { ok: result.ok, message: result.message }
}
