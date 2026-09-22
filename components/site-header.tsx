"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail02Icon } from "@hugeicons/core-free-icons";
import { CATEGORIES } from "@/lib/posts";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/search-bar";
import { EpisodesSearchBar } from "@/components/episodes/episodes-search-bar";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/episodes", label: "Episodes" },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const isEpisodesSection = pathname?.startsWith("/episodes");
  const isHome = pathname === "/";

  useEffect(() => {
    const handleScroll = () => setIsAtTop(window.scrollY < 48);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNewsletterClick = () => {
    const target = document.getElementById("newsletter");
    if (!target) {
      // Newsletter section isn't on this page (e.g. an admin page) — go to homepage first
      router.push("/#newsletter");
      return;
    }
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (isDesktop) {
      // Already visible on desktop — pulse-highlight instead of scrolling
      target.classList.add("newsletter-highlight");
      setTimeout(() => target.classList.remove("newsletter-highlight"), 1200);
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const visibleNavLinks = NAV_LINKS.filter((l) => {
    if (l.href === "/" && isHome) return false;
    if (l.href === "/episodes" && isEpisodesSection) return false;
    return true;
  });

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/90 shadow-[0_8px_30px_-24px_hsl(var(--primary))] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center gap-3 px-4 md:px-6">
        <Link
          href={isEpisodesSection ? "/episodes" : "/"}
          className="group flex shrink-0 items-center gap-2.5 font-display text-xl font-bold tracking-tight"
          aria-label="OtakuNaija home"
        >
          <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-primary/30 bg-primary/10 shadow-[0_0_22px_-8px_hsl(var(--primary))]">
            <img src="/logo.png" alt="" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
          </span>
          <span className="hidden sm:inline">Otaku<span className="text-primary">Naija</span></span>
        </Link>

        <nav className="ml-3 hidden items-center gap-1 rounded-full border border-border/70 bg-card/50 p-1 md:flex" aria-label="Primary navigation">
          {visibleNavLinks.map((l) => {
            const isActive = l.href === "/" ? isHome : pathname === l.href || pathname?.startsWith(`${l.href}/`)
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"}`}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <div className={`mx-1 w-[min(42vw,22rem)] transition-[width] duration-300 sm:w-[min(38vw,24rem)] ${isAtTop ? "md:w-[min(32vw,24rem)]" : "md:w-[min(28vw,20rem)]"}`}>
            {isEpisodesSection ? (
              <EpisodesSearchBar compact />
            ) : (
              <SearchBar compact />
            )}
          </div>
          <Button variant="default" onClick={handleNewsletterClick} className="hidden h-9 items-center gap-1.5 rounded-full bg-primary px-4 font-semibold text-primary-foreground shadow-[0_6px_20px_-10px_hsl(var(--primary))] hover:bg-primary/90 md:inline-flex">
            <HugeiconsIcon icon={Mail02Icon} className="h-4 w-4" strokeWidth={2} /> Newsletter
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNewsletterClick} aria-label="Newsletter" className="rounded-full text-primary hover:bg-primary/10 md:hidden">
            <HugeiconsIcon icon={Mail02Icon} className="h-5 w-5" strokeWidth={2} />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary md:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen((s) => !s)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {!isEpisodesSection && (
        <div className="hidden md:block border-t border-border bg-card/40">
          <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2 md:px-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Categories:
            </span>
            {CATEGORIES.map((c) => (
              <Link
                key={c}
                href={`/blog?category=${encodeURIComponent(c)}`}
                className="text-xs font-medium text-foreground/80 hover:text-primary whitespace-nowrap"
              >
                {c}
              </Link>
            ))}
          </div>
        </div>
      )}

      {mobileOpen ? (
        <div className="border-t border-border/70 bg-background/95 shadow-lg backdrop-blur-xl md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
            {visibleNavLinks.map((l) => {
              const isActive = l.href === "/" ? isHome : pathname === l.href || pathname?.startsWith(`${l.href}/`)
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${isActive ? "bg-primary/12 text-primary" : "text-foreground/90 hover:bg-card hover:text-primary"}`}
                >
                  {l.label}
                </Link>
              )
            })}
            {!isEpisodesSection && (
              <div className="mt-2 border-t border-border pt-3">
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Categories
                </p>
                {CATEGORIES.map((c) => (
                  <Link
                    key={c}
                    href={`/blog?category=${encodeURIComponent(c)}`}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-card hover:text-primary"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
