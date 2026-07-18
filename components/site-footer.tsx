import Link from "next/link"
import { CATEGORIES } from "@/lib/posts"
import { AdSlot } from "@/components/ad-slot"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40 mt-16">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="py-8">
          <AdSlot slot="footer" label="Advertisement" />
        </div>

        <div className="grid gap-10 py-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
              <img
                src="/logo.png"
                alt="OtakuNaija logo"
                className="h-8 w-8 rounded-md object-cover"
              />
              Otaku<span className="text-primary">Naija</span>
            </Link>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Nigeria&apos;s home for anime culture. We cover the latest news, reviews, and guides for every Naija
              otaku — from Shonen marathons to slice-of-life classics.
            </p>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Explore</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-muted-foreground hover:text-primary">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/episodes" className="text-muted-foreground hover:text-primary">
                  Episodes
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-primary">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-primary">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Categories</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {CATEGORIES.map((c) => (
                <li key={c}>
                  <Link
                    href={`/blog?category=${encodeURIComponent(c)}`}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} OtakuNaija. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-primary">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-primary">
              Terms &amp; Conditions
            </Link>
            <Link href="/contact" className="hover:text-primary">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
