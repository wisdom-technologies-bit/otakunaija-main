/**
 * Newsletter configuration.
 *
 * Everything the pipeline needs from the environment is read here once, with
 * the documented defaults, so the cron routes, the admin screens and the tests
 * all agree on what "the daily cap" or "the sender" means.
 *
 * No secret is ever logged: callers use `describeNewsletterConfig()` which
 * reports presence, and `maskEmail()` for addresses.
 */

export type NewsletterMode = "approve" | "auto"

export const DEFAULT_SITE_URL = "https://otakunaija.name.ng"
export const DEFAULT_FROM_EMAIL = "press@otakunaija.name.ng"
export const DEFAULT_FROM_NAME = "OtakuNaija"
export const DEFAULT_DAILY_CAP = 250
/** Conservative: Brevo's messageVersions ceiling is far higher than this. */
export const BREVO_CHUNK_SIZE = 50

export type NewsletterEnv = Record<string, string | undefined>

export type NewsletterConfig = {
  /** Present means sending is possible at all. */
  brevoApiKey: string | null
  brevoWebhookSecret: string | null
  fromEmail: string
  fromName: string
  replyTo: string | null
  mode: NewsletterMode
  dailyCap: number
  postalAddress: string
  siteUrl: string
  /** Brevo tags: identifies the program in their dashboard. */
  tag: string
}

function envInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((raw ?? "").trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function envTrim(raw: string | undefined): string | null {
  const value = (raw ?? "").trim()
  return value.length > 0 ? value : null
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

export function newsletterConfig(env: NewsletterEnv = process.env): NewsletterConfig {
  const mode = (env.NEWSLETTER_MODE ?? "").trim().toLowerCase() === "auto" ? "auto" : "approve"

  return {
    brevoApiKey: envTrim(env.BREVO_API_KEY),
    brevoWebhookSecret: envTrim(env.BREVO_WEBHOOK_SECRET),
    fromEmail: envTrim(env.NEWSLETTER_FROM_EMAIL) ?? DEFAULT_FROM_EMAIL,
    fromName: envTrim(env.NEWSLETTER_FROM_NAME) ?? DEFAULT_FROM_NAME,
    replyTo: envTrim(env.NEWSLETTER_REPLY_TO),
    mode,
    dailyCap: envInt(env.NEWSLETTER_DAILY_CAP, DEFAULT_DAILY_CAP),
    postalAddress:
      envTrim(env.NEWSLETTER_POSTAL_ADDRESS) ??
      "OtakuNaija, Lagos, Nigeria",
    siteUrl: trimSlash(envTrim(env.SITE_URL) ?? DEFAULT_SITE_URL),
    tag: "daily-digest",
  }
}

/** Safe to log: says whether each secret exists, never what it is. */
export function describeNewsletterConfig(config: NewsletterConfig) {
  return {
    brevoConfigured: Boolean(config.brevoApiKey),
    webhookConfigured: Boolean(config.brevoWebhookSecret),
    mode: config.mode,
    dailyCap: config.dailyCap,
    from: config.fromEmail,
    siteUrl: config.siteUrl,
  }
}

/** a***@domain — the only form of an address that may appear in a log. */
export function maskEmail(email: string): string {
  const value = (email ?? "").trim()
  const at = value.lastIndexOf("@")
  if (at <= 0) return "***"
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  const head = local.slice(0, 1).toLowerCase()
  return `${head}***@${domain}`
}

export function absoluteUrl(config: NewsletterConfig, path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`
  return `${config.siteUrl}${suffix}`
}
