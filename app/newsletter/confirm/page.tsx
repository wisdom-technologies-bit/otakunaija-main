import type { Metadata } from "next"
import Link from "next/link"
import { NewsletterNotice, NewsletterPage } from "@/components/newsletter/newsletter-page"
import { confirmSubscription } from "@/lib/newsletter/subscribe"
import { subscribeStore } from "@/lib/newsletter/runtime"

export const metadata: Metadata = {
  title: "Confirm your subscription",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const result = token
    ? await confirmSubscription(token, { store: subscribeStore, now: new Date() })
    : { ok: false, message: "This link is missing its token. Use the link from your confirmation email.", subscriber: null }

  return (
    <NewsletterPage
      eyebrow="OtakuNaija newsletter"
      title={result.ok ? "You're confirmed" : "That link did not work"}
    >
      <div className="space-y-4">
        <NewsletterNotice
          tone={result.ok ? "success" : "error"}
          title={result.ok ? "Your daily briefing is on" : "We could not confirm this address"}
        >
          <p>{result.message}</p>
        </NewsletterNotice>

        {result.ok ? (
          <p className="text-sm text-muted-foreground">
            The next briefing arrives tomorrow morning. You can change what it includes, or stop it entirely, from the
            links at the bottom of any email.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Links expire when they are used, and only work for the address they were sent to. If you need a new one,{" "}
            <Link href="/" className="underline hover:text-foreground">
              sign up again on the home page
            </Link>{" "}
            and we will send a fresh confirmation.
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/blog"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Read the latest
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
          >
            Back to the home page
          </Link>
        </div>
      </div>
    </NewsletterPage>
  )
}
