/**
 * Concrete dependency wiring.
 *
 * The pipeline modules take narrow store interfaces so they can be tested
 * without a database; this file is the single place where those interfaces are
 * bound to the real SQL functions. Nothing here decides anything.
 */

import { BrevoClient } from "./brevo"
import { newsletterConfig, type NewsletterConfig } from "./config"
import { prepareIssue, type PrepareDeps, type PrepareStore } from "./prepare"
import { runSend, type SendStore } from "./send"
import * as store from "./store"
import { signupLimiter } from "./rate-limit"
import { renderConfirmationEmail } from "./transactional"
import type { RenderBrand } from "./render/context"

export function siteBrand(config: NewsletterConfig): RenderBrand {
  return {
    siteUrl: config.siteUrl,
    fromName: config.fromName,
    postalAddress: config.postalAddress,
    // A square 512px PNG is not worth 179 KB in an inbox; set
    // NEWSLETTER_LOGO_URL to a small transparent PNG to show a mark.
    logoUrl: (process.env.NEWSLETTER_LOGO_URL ?? "").trim() || null,
    replyTo: config.replyTo,
  }
}

const prepareStore: PrepareStore = {
  getIssueByDate: store.getIssueByDate,
  lastSentIssue: store.lastSentIssue,
  recentIssues: store.recentIssues,
  insertIssue: store.insertIssue,
}

const sendStore: SendStore = {
  getIssueByDate: store.getIssueByDate,
  updateIssue: store.updateIssue,
  isPaused: store.isPaused,
  countSentToday: store.countSentToday,
  listRecipients: store.listRecipients,
  markSent: store.markSent,
  countWeekly: store.countWeekly,
}

export function prepareDeps(now: Date, dry: boolean): PrepareDeps {
  const config = newsletterConfig()
  return {
    now,
    config,
    store: prepareStore,
    readSources: store.readSelectSources,
    dry,
    logoUrl: siteBrand(config).logoUrl,
  }
}

export function sendDeps(input: { now: Date; dry: boolean; limit?: number | null }) {
  const config = newsletterConfig()
  return {
    now: input.now,
    config,
    store: sendStore,
    brevo: new BrevoClient(config),
    dry: input.dry,
    limit: input.limit ?? null,
    logoUrl: siteBrand(config).logoUrl,
  }
}

export async function prepareRuntime(now: Date, dry: boolean) {
  return prepareIssue(prepareDeps(now, dry))
}

export async function sendRuntime(input: { now: Date; dry: boolean; limit?: number | null }) {
  return runSend(sendDeps(input))
}

// ---------------------------------------------------------------------------
// Subscribe flow
// ---------------------------------------------------------------------------

export const subscribeStore = {
  getByEmail: store.getSubscriberByEmail,
  getByToken: store.getSubscriberByToken,
  insert: store.insertSubscriber,
  setPending: (id: number, options: { source: string }) => store.setSubscriberPending(id, options),
  confirm: store.confirmSubscriber,
  unsubscribe: store.unsubscribeSubscriber,
  updatePrefs: store.updateSubscriberPrefs,
}

/** Sends the double opt-in email. Never throws: the form reports failure. */
export async function sendConfirmationEmail(input: { email: string; token: string }): Promise<{ ok: boolean; reason?: string }> {
  const config = newsletterConfig()
  const brevo = new BrevoClient(config)
  if (!config.brevoApiKey) return { ok: false, reason: "brevo_not_configured" }

  const template = await renderConfirmationEmail(siteBrand(config))
  const result = await brevo.sendTransactional({
    to: input.email,
    subject: template.subject,
    html: template.html.split("__NL_TOKEN__").join(input.token),
    text: template.text.split("__NL_TOKEN__").join(input.token),
    tags: [config.tag, "double-opt-in"],
  })

  return result.ok ? { ok: true } : { ok: false, reason: result.reason }
}

export { signupLimiter }
