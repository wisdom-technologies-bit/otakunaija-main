import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "Privacy",
  description: "How OtakuNaija collects, uses, and protects your information.",
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  const lastUpdated = "January 2026"

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Legal</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

          <div className="prose-anime mt-10">
            <p>
              At OtakuNaija (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;), we respect your privacy and are committed
              to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard
              the data we receive when you visit otakunaija.name.ng.
            </p>

            <h2>Information we collect</h2>
            <p>
              We collect minimal personal information, only when you choose to share it. This includes your email
              address (when you subscribe to our newsletter) and the contents of any messages you send via our
              contact form. We also collect anonymous analytics such as page views, browser type, country, and
              referral source.
            </p>

            <h2>Our newsletter</h2>
            <p>
              The newsletter is one email each morning, Nigerian time: the news that matters, new episodes, and what
              airs next. Nothing is sent until you confirm your address by tapping the link in our first email, and
              every issue carries a one-click unsubscribe link and a link to your preferences, where you can choose
              whether to receive news, new episodes and upcoming airings, and whether you want a daily or a
              Sunday-only email.
            </p>
            <p>
              We send it through Brevo, which acts as our email processor: it holds your address and delivers the
              message on our behalf, and it records delivery, open and click events so we know whether the email is
              working. We do not sell or rent subscriber addresses. We keep a subscription, including the delivery
              data attached to it, until you unsubscribe; after that the address is marked unsubscribed and is not
              emailed again unless you sign up afresh.
            </p>

            <h2>How we use information</h2>
            <ul>
              <li>To deliver our newsletter and respond to your inquiries.</li>
              <li>To improve our content, design, and overall reader experience.</li>
              <li>To detect, prevent, and address abuse, fraud, or technical issues.</li>
              <li>To comply with legal obligations.</li>
            </ul>

            <h2>Cookies</h2>
            <p>
              We use cookies and similar technologies to remember your preferences, measure traffic, and serve
              relevant advertising. You can disable cookies via your browser settings, but some features of the site
              may stop working as expected.
            </p>

            <h2>Third-party services</h2>
            <p>
              We use Ads pateners to serve ads. Our ads partners may use cookies to deliver advertisements
              based on your prior visits to this and other websites. You can opt out of personalized advertising by
              visiting <a href="https://adssettings.google.com" target="_blank" rel="noreferrer">Google Ads
              Settings</a>.
            </p>
            <p>
              We also use Vercel Analytics for anonymous traffic measurement. No personally identifiable information
              is collected by these tools without your consent.
            </p>
            <p>
              Our newsletter is delivered by{" "}
              <a href="https://www.brevo.com" target="_blank" rel="noreferrer">
                Brevo
              </a>
              , which processes subscriber email addresses and delivery events on our instructions.
            </p>

            <h2>Data retention</h2>
            <p>
              Newsletter subscriptions are kept until you unsubscribe, together with the delivery, open and click
              events attached to them. Unsubscribing stops all further email and keeps only the record needed to
              honour that choice; signing up again after that creates a fresh pending subscription that you have to
              confirm. Contact form messages are retained for up to two years for support and reference purposes,
              then deleted.
            </p>

            <h2>Your rights</h2>
            <p>
              You can request access to, correction of, or deletion of any personal data we hold about you by
              emailing <a href="mailto:hello@otakunaija.name.ng">hello@otakunaija.name.ng</a>. We will respond within 30
              days.
            </p>

            <h2>Children&apos;s privacy</h2>
            <p>
              OtakuNaija is not directed at children under 13. We do not knowingly collect personal information from
              children. If you believe a child has shared information with us, please contact us so we can remove it.
            </p>

            <h2>Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be announced on the homepage at least
              7 days before they take effect.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about this policy? Email us at{" "}
              <a href="mailto:hello@otakunaija.name.ng">hello@otakunaija.name.ng</a>.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
