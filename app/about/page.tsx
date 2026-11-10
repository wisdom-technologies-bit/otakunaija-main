import type { Metadata } from "next"
import Link from "next/link"
import { Sparkles, Globe, BookOpen, Users } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { AdSlot } from "@/components/ad-slot"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about OtakuNaija — Nigeria's home for anime news, reviews, and culture. Our story, mission, and the team behind every article.",
  alternates: { canonical: "/about" },
}

const VALUES = [
  {
    icon: Sparkles,
    title: "Authentic perspectives",
    body: "Every article is written by Nigerian anime fans who actually watch the shows. No AI fluff, no scraped lists.",
  },
  {
    icon: Globe,
    title: "Naija meets the world",
    body: "We celebrate the global anime community while keeping our coverage rooted in the Nigerian experience.",
  },
  {
    icon: BookOpen,
    title: "Editorial integrity",
    body: "Reviews are honest, news is verified, and recommendations are based on lived viewing — not paid placements.",
  },
  {
    icon: Users,
    title: "Built with the community",
    body: "We listen. Reader feedback drives our coverage roadmap, from genre deep-dives to streaming guides.",
  },
]

export default function AboutPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <div className="py-4">
            <AdSlot slot="header" />
          </div>

          <section className="py-10 md:py-16">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">About OtakuNaija</p>
            <h1 className="mt-3 font-display text-4xl md:text-6xl font-bold tracking-tight text-balance">
              Anime, written by Naija. Read by the world.
            </h1>
            <p className="mt-5 max-w-2xl text-base md:text-lg leading-relaxed text-muted-foreground">
              OtakuNaija was founded in 2024 to give Nigerian anime fans a real seat at the table. We cover the
              shows, characters, and conversations that matter — from the latest Shonen Jump chapter to the
              streaming wars reshaping how we watch.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 md:p-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold">Our story</h2>
            <div className="mt-4 space-y-4 text-foreground/90 leading-relaxed">
              <p>
                It started in a Lagos WhatsApp group. A handful of us were tired of foreign sites missing the
                shows we actually loved, the timing of African releases, and the cultural lens we bring to anime
                fandom. So we built our own platform.
              </p>
              <p>
                Today, OtakuNaija reaches readers across Lagos, Abuja, Port Harcourt, and around the world.
                We&apos;ve covered every major release of the past two years and built a community of Naija
                otakus who finally see themselves in anime journalism.
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Our news desk summarises reports from outlets such as Anime News Network, credits them, and links to the
              original. Publishers can request a correction or removal at any time via our{" "}
              <a className="text-primary underline underline-offset-4" href="/contact">contact page</a>.
            </p>
          </section>

          <section className="py-12">
            <h2 className="font-display text-2xl md:text-3xl font-bold">What we stand for</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {VALUES.map((v) => (
                <div key={v.title} className="rounded-xl border border-border bg-card p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <v.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="my-8 rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-semibold">Data and attribution</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Anime metadata and artwork come from AniList and Anivexa, and some title logos come from The Movie
              Database (TMDB). This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
          </section>

          <section className="my-8">
            <AdSlot slot="in-article" />
          </section>

          <section className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-12 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-balance">Get in touch</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Got a tip, want to pitch an article, or just want to talk anime? We read every message.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/contact">Contact us</Link>
              </Button>
              <Button asChild variant="outline" className="border-border bg-transparent">
                <Link href="/blog">Read the blog</Link>
              </Button>
            </div>
          </section>

          <div className="py-8" />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
