"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, Search, X } from "lucide-react"
import { CATEGORIES } from "@/lib/posts"
import { Button } from "@/components/ui/button"
import { SearchBar } from "@/components/search-bar"

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
]

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-display text-sm">
            ON
          </span>
          <span className="hidden sm:inline">
            Otaku<span className="text-primary">Naija</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 ml-6">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle search"
            onClick={() => setSearchOpen((s) => !s)}
            className="text-foreground/80 hover:text-primary"
          >
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-foreground/80 hover:text-primary"
            aria-label="Open menu"
            onClick={() => setMobileOpen((s) => !s)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {searchOpen ? (
        <div className="border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-4 py-3 md:px-6">
            <SearchBar autoFocus onSubmitted={() => setSearchOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="hidden md:block border-t border-border bg-card/40">
        <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2 md:px-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories:</span>
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

      {mobileOpen ? (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground/90 hover:bg-card hover:text-primary"
              >
                {l.label}
              </Link>
            ))}
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
          </nav>
        </div>
      ) : null}
    </header>
  )
}
