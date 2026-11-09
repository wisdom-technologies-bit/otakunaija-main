import { NextRequest, NextResponse } from "next/server"
import { newsletterConfig } from "@/lib/newsletter/config"
import { handleBrevoWebhook, verifyWebhookRequest } from "@/lib/newsletter/webhook"
import {
  countEvents,
  getSubscriberByEmail,
  insertEvent,
  setSubscriberStatus,
} from "@/lib/newsletter/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Brevo delivery webhook.
 *
 * Authenticate with `Authorization: Bearer $BREVO_WEBHOOK_SECRET` or
 * `?secret=$BREVO_WEBHOOK_SECRET` (Brevo's UI only takes a URL). Batches and
 * unknown event types are tolerated, and retried events are deduped by the
 * unique index on newsletter_events.
 *
 * Brevo retries non-2xx responses, so this answers 200 for anything it
 * understood, including duplicates.
 */
export async function POST(request: NextRequest) {
  const config = newsletterConfig()

  const auth = verifyWebhookRequest({
    authorization: request.headers.get("authorization"),
    secretParam: request.nextUrl.searchParams.get("secret"),
    expected: config.brevoWebhookSecret,
  })

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    const summary = await handleBrevoWebhook(payload, {
      getSubscriberByEmail,
      setSubscriberStatus,
      insertEvent,
      countEvents,
    })
    return NextResponse.json(summary, { status: 200 })
  } catch {
    // Malformed but authenticated: acknowledge so Brevo stops retrying a
    // payload we will never be able to parse.
    return NextResponse.json({ received: 0, stored: 0, error: "processing_failed" }, { status: 200 })
  }
}

/** Brevo's "test" button sometimes probes the URL with GET. */
export async function GET(request: NextRequest) {
  const config = newsletterConfig()
  const auth = verifyWebhookRequest({
    authorization: request.headers.get("authorization"),
    secretParam: request.nextUrl.searchParams.get("secret"),
    expected: config.brevoWebhookSecret,
  })

  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ ok: true, endpoint: "brevo-webhook" })
}
