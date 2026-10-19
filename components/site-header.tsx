"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Menu, Search, Sparkles, X } from "lucide-react";
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const pathname = usePathname();
  const isEpisodesSection = pathname?.startsWith("/episodes");
  const isHome = pathname === "/";

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
          <div className="mx-1 hidden w-[min(42vw,22rem)] transition-[width] duration-300 sm:w-[min(38vw,24rem)] md:block">
            {isEpisodesSection ? <EpisodesSearchBar compact /> : <SearchBar compact />}
          </div>
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary md:hidden" aria-label="Open search" onClick={() => setMobileSearchOpen(true)}>
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary md:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen((s) => !s)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="absolute inset-x-3 top-[4.75rem] z-50 rounded-2xl border border-border bg-background/95 p-3 shadow-2xl backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">{isEpisodesSection ? <EpisodesSearchBar compact autoFocus /> : <SearchBar compact />}</div>
            <Button variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label="Close search" onClick={() => setMobileSearchOpen(false)}><X className="h-5 w-5" /></Button>
          </div>
        </div>
      )}

      {!isEpisodesSection && (
        <div className="hidden border-t border-border/60 bg-card/30 md:block">
          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] md:px-6">
            <div className="mr-2 flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Discover
            </div>
            {CATEGORIES.map((c, index) => (
              <Link key={c} href={`/blog?category=${encodeURIComponent(c)}`} className="group flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/50 transition-colors group-hover:bg-primary" aria-hidden="true" />
                {c}
                {index === 0 && <span className="rounded bg-primary/10 px-1 text-[9px] uppercase tracking-wide text-primary">Hot</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {mobileOpen ? (
        <div className="border-t border-border/70 bg-background/95 shadow-lg backdrop-blur-xl md:hidden">
          <nav className="mx-auto max-w-7xl px-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {visibleNavLinks.map((l) => {
                const isActive = l.href === "/" ? isHome : pathname === l.href || pathname?.startsWith(`${l.href}/`)
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 text-sm font-bold transition-all ${isActive ? "border-primary/40 bg-primary/12 text-primary shadow-[0_8px_24px_-16px_hsl(var(--primary))]" : "border-border/70 bg-card/40 text-foreground/90 hover:border-primary/30 hover:bg-primary/10 hover:text-primary"}`}
                  >
                    {l.label}
                    <ChevronRight className="h-4 w-4 opacity-60" aria-hidden="true" />
                  </Link>
                )
              })}
            </div>
            {!isEpisodesSection && (
              <div className="mt-5 border-t border-border/70 pt-4">
                <div className="mb-3 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Explore by mood
                </div>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <Link
                      key={c}
                      href={`/blog?category=${encodeURIComponent(c)}`}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-full border border-border/70 bg-card/50 px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                    >
                      {c}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
