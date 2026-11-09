import { NewsletterForm } from "@/components/newsletter-form"

/** Compact inline newsletter bar, kept out of the intro strip. */
export function NewsletterInlineBar() {
  return (
    <section className="otk-newsletter-bar" aria-labelledby="home-newsletter-title">
      <div className="min-w-0">
        <p id="home-newsletter-title" className="text-sm font-bold text-[var(--otk-text)]">
          Get the daily anime briefing
        </p>
        <p className="otk-meta mt-1">One email each morning. News, releases and what to watch.</p>
      </div>
      <NewsletterForm variant="inline" className="max-w-md md:min-w-[20rem]" />
    </section>
  )
}

export default NewsletterInlineBar
