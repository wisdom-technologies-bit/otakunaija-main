/**
 * Slim one-line introduction under the hero. The newsletter form now lives in
 * its own compact bar further down the page.
 */
export function HomeIntroStrip() {
  return (
    <section className="border-y border-[var(--otk-border)]" aria-labelledby="home-intro-title">
      <div className="hp-container flex flex-col gap-2 py-4 md:flex-row md:items-baseline md:justify-between md:gap-8 md:py-5">
        <h1 id="home-intro-title" className="hp-intro-title text-balance">
          Anime news, reviews &amp; guides for Nigerian otakus
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-[var(--otk-text-dim)]">
          Reporting and recommendations from Lagos, for the global anime community.
        </p>
      </div>
    </section>
  )
}

export default HomeIntroStrip
