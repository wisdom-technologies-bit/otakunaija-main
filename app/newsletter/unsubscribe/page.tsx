import type { Metadata } from "next"
import Link from "next/link"
import { NewsletterNotice, NewsletterPage } from "@/components/newsletter/newsletter-page"
import { unsubscribeAction } from "@/app/newsletter/actions"
import { getSubscriberByToken } from "@/lib/newsletter/store"
import { maskEmail } from "@/lib/newsletter/config"

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string; error?: string }>
}) {
  const { token, done, error } = await searchParams
  const subscriber = token ? await getSubscriberByToken(token) : null

  if (!subscriber) {
    return (
      <NewsletterPage eyebrow="OtakuNaija newsletter" title="That link did not work">
        <NewsletterNotice tone="error" title="We could not find that subscription">
          <p>
            The link may have been cut in half by your email app, or the token no longer exists. Use the unsubscribe
            link at the bottom of the email you received.
          </p>
        </NewsletterNotice>
      </NewsletterPage>
    )
  }

  const alreadyOut = subscriber.status === "unsubscribed" || done === "1"

  return (
    <NewsletterPage
      eyebrow="OtakuNaija newsletter"
      title={alreadyOut ? "You're unsubscribed" : "Stop the daily email?"}
      intro={alreadyOut ? undefined : `This removes ${maskEmail(subscriber.email)} from the daily briefing.`}
    >
      {alreadyOut ? (
        <div className="space-y-4">
          <NewsletterNotice tone="success" title="No more daily emails">
            <p>You will not receive the briefing again. Nothing else changes on your account.</p>
          </NewsletterNotice>
          <p className="text-sm text-muted-foreground">
            If this was a mistake, sign up again on the{" "}
            <Link href="/" className="underline hover:text-foreground">
              home page
            </Link>{" "}
            and confirm the new email.
          </p>
        </div>
      ) : (
        <form action={unsubscribeAction} className="space-y-5">
          <input type="hidden" name="token" value={token} />
          <label className="block text-sm font-medium" htmlFor="reason">
            Anything we should know? (optional)
          </label>
          <input
            id="reason"
            name="reason"
            type="text"
            maxLength={200}
            placeholder="Too many emails, wrong topics, not watching much right now…"
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Unsubscribe
            </button>
            <Link
              href={`/newsletter/preferences?token=${encodeURIComponent(token ?? "")}`}
              className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-semibold hover:bg-muted"
            >
              Change what I get instead
            </Link>
          </div>
        </form>
      )}
      {error ? (
        <p className="mt-4 text-sm text-destructive">
          {error === "invalid-token" ? "That link did not work." : "The link was missing its token."}
        </p>
      ) : null}
    </NewsletterPage>
  )
}
