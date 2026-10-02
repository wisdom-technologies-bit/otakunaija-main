import { NewsletterForm } from "@/components/newsletter-form"

export function HomeIntroStrip() {
  return (
    <section className="home-premium-intro border-y border-[var(--hp-border)]" aria-labelledby="home-intro-title">
      <div className="hp-container flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-10">
        <div className="max-w-2xl">
          <h1 id="home-intro-title" className="hp-intro-title">Anime News, Reviews &amp; Guides for Nigerian Otakus</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--hp-text-dim)]">Reviews, episode breakdowns, and recommendations from Nigerian otakus for the global anime community.</p>
        </div>
        <NewsletterForm variant="inline" className="md:w-auto md:min-w-[24rem]" />
      </div>
    </section>
  )
}
