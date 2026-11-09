import type { Metadata } from "next"
import Link from "next/link"
import { NewsletterNotice, NewsletterPage } from "@/components/newsletter/newsletter-page"
import { savePreferencesAction, unsubscribeAction } from "@/app/newsletter/actions"
import { getSubscriberByToken } from "@/lib/newsletter/store"
import { normalisePrefs } from "@/lib/newsletter/types"

export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const MODULES = [
  {
    name: "news",
    label: "News and blog posts",
    hint: "The stories we published, with the lead one first.",
  },
  {
    name: "episodes",
    label: "New episodes",
    hint: "Episodes that landed, grouped by series, with a direct watch link.",
  },
  {
    name: "upcoming",
    label: "Airing and upcoming",
    hint: "What airs in the next day or two, and what premieres this season.",
  },
] as const

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; saved?: string; error?: string }>
}) {
  const { token, saved, error } = await searchParams
  const subscriber = token ? await getSubscriberByToken(token) : null

  if (!subscriber) {
    return (
      <NewsletterPage eyebrow="OtakuNaija newsletter" title="That link did not work">
        <NewsletterNotice tone="error" title="We could not find that subscription">
          <p>Use the preferences link at the bottom of the most recent email from us.</p>
        </NewsletterNotice>
      </NewsletterPage>
    )
  }

  const prefs = normalisePrefs(subscriber.prefs)

  return (
    <NewsletterPage
      eyebrow="OtakuNaija newsletter"
      title="Email preferences"
      intro="The briefing goes out every morning. Choose what it includes, or how often it arrives."
    >
      {saved === "1" ? (
        <div className="mb-5">
          <NewsletterNotice tone="success" title="Preferences saved">
            <p>The next briefing will follow these settings.</p>
          </NewsletterNotice>
        </div>
      ) : null}
      {error ? (
        <p className="mb-5 text-sm text-destructive">
          {error === "invalid-token" ? "That link did not work." : "The link was missing its token."}
        </p>
      ) : null}

      <form action={savePreferencesAction} className="space-y-7">
        <input type="hidden" name="token" value={token} />

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">What to include</legend>
          {MODULES.map((module) => (
            <label
              key={module.name}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 hover:bg-muted/40"
            >
              <input
                type="checkbox"
                name={module.name}
                defaultChecked={prefs[module.name]}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span>
                <span className="block text-sm font-medium">{module.label}</span>
                <span className="block text-xs text-muted-foreground">{module.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">How often</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 hover:bg-muted/40">
            <input
              type="radio"
              name="frequency"
              value="daily"
              defaultChecked={prefs.frequency === "daily"}
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <span>
              <span className="block text-sm font-medium">Every morning</span>
              <span className="block text-xs text-muted-foreground">One email a day, around 7am West Africa Time.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 hover:bg-muted/40">
            <input
              type="radio"
              name="frequency"
              value="weekly"
              defaultChecked={prefs.frequency === "weekly"}
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <span>
              <span className="block text-sm font-medium">Sundays only</span>
              <span className="block text-xs text-muted-foreground">
                The same briefing, once a week, on Sunday morning.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Save preferences
          </button>
          <Link
            href={`/newsletter/unsubscribe?token=${encodeURIComponent(token ?? "")}`}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Unsubscribe instead
          </Link>
        </div>
      </form>

      <form action={unsubscribeAction} className="mt-8 border-t border-border pt-6">
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="text-xs text-muted-foreground underline hover:text-foreground">
          Stop all emails from OtakuNaija
        </button>
      </form>
    </NewsletterPage>
  )
}
