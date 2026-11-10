import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms governing your use of OtakuNaija.",
  alternates: { canonical: "/terms" },
}

export default function TermsPage() {
  const lastUpdated = "January 2026"

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Legal</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">Terms &amp; Conditions</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

          <div className="prose-anime mt-10">
            <p>
              By accessing or using OtakuNaija (otakunaija.name.ng), you agree to be bound by these Terms &amp;
              Conditions. If you do not agree, please do not use the site.
            </p>

            <h2>Use of content</h2>
            <p>
              All articles, images, and other materials on OtakuNaija are owned by us or our licensors and are
              protected by copyright. You may share short excerpts (under 200 words) with attribution and a link back
              to the original article. Republishing full articles, scraping content, or training machine-learning
              models on our content without explicit written permission is prohibited.
            </p>

            <h2>News and sources</h2>
            <p>
              OtakuNaija&apos;s news articles are written by OtakuNaija from facts reported by third-party outlets
              such as Anime News Network. Original reports remain the property of their publishers, and we link to the
              original article on every news story we cover.
            </p>
            <p>
              If you own a story or image and want a correction or removal, contact us through the{" "}
              <a href="/contact">contact page</a> and we will respond promptly.
            </p>

            <h2>User-submitted content</h2>
            <p>
              When you send us a message, comment, or pitch, you grant us a non-exclusive, royalty-free license to
              use, edit, and republish the content. You confirm that you own the rights to anything you submit and
              that it does not infringe on others&apos; rights.
            </p>

            <h2>Acceptable use</h2>
            <ul>
              <li>Do not attempt to disrupt, attack, or reverse-engineer the site.</li>
              <li>Do not impersonate other people or organizations.</li>
              <li>Do not use OtakuNaija for unlawful, harassing, or hateful behavior.</li>
              <li>Do not upload malicious code or attempt to gain unauthorized access.</li>
            </ul>

            <h2>Disclaimer</h2>
            <p>
              Articles on OtakuNaija are provided for informational and entertainment purposes only. While we strive
              for accuracy, we make no warranties about completeness, reliability, or fitness for any particular
              purpose. Reviews represent the opinions of individual writers.
            </p>

            <h2>Third-party data and attribution</h2>
            <p>
              Series metadata and artwork come from AniList, Anivexa and The Movie Database (TMDB). This product uses
              the TMDB API but is not endorsed or certified by TMDB.
            </p>

            <h2>Affiliate links and ads</h2>
            <p>
              Some pages contain affiliate links and Google AdSense advertisements. We may earn a commission from
              qualifying purchases at no additional cost to you. Sponsored content is always clearly labeled.
            </p>

            <h2>Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, OtakuNaija shall not be liable for any indirect, incidental,
              consequential, or punitive damages arising out of your use of the site.
            </p>

            <h2>Termination</h2>
            <p>
              We reserve the right to suspend or terminate access to OtakuNaija for users who violate these terms,
              without notice.
            </p>

            <h2>Governing law</h2>
            <p>
              These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes will be resolved
              in the courts of Lagos State.
            </p>

            <h2>Changes to these terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the site after changes are posted
              constitutes acceptance of the updated terms.
            </p>

            <h2>Contact</h2>
            <p>
              Questions? Email <a href="mailto:hello@otakunaija.name.ng">hello@otakunaija.name.ng</a>.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
