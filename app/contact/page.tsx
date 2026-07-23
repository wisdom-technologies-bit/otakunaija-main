import type { Metadata } from "next"
import { Mail, MapPin, Twitter } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ContactForm } from "@/components/contact-form"
import { AdSlot } from "@/components/ad-slot"

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the OtakuNaija team. Send tips, pitch articles, or share feedback about Nigeria's leading anime publication.",
  alternates: { canonical: "/contact" },
}

export default function ContactPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="py-4">
            <AdSlot slot="header" />
          </div>

          <section className="py-10 md:py-14">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Get in touch</p>
            <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight text-balance">
              Tell us what you&apos;re thinking.
            </h1>
            <p className="mt-4 max-w-2xl text-base md:text-lg text-muted-foreground">
              Whether it&apos;s a story tip, a pitch, an ad partnership, or feedback on something we wrote — we
              read every message and respond within 48 hours.
            </p>
          </section>

          <div className="grid gap-10 pb-16 lg:grid-cols-[1fr_320px]">
            <div className="rounded-xl border border-border bg-card p-6 md:p-10">
              <ContactForm />
            </div>

            <aside className="space-y-5">
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-display text-base font-semibold">Other ways to reach us</h3>
                <ul className="mt-4 space-y-4 text-sm">
                  <li className="flex gap-3">
                    <Mail className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">Email</p>
                      <a
                        href="mailto:hello@otakunaija.name.ng"
                        className="text-muted-foreground hover:text-primary"
                      >
                        hello@otakunaija.name.ng
                      </a>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <Twitter className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">Twitter / X</p>
                      <a
                        href="https://twitter.com/otakunaija"
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-primary"
                      >
                        @otakunaija
                      </a>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <MapPin className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">Based in</p>
                      <p className="text-muted-foreground">Lagos, Nigeria</p>
                    </div>
                  </li>
                </ul>
              </div>

              <AdSlot slot="sidebar" />
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
