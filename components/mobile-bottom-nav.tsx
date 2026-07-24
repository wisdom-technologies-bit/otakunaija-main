'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Newspaper, Clapperboard, Search, Menu } from 'lucide-react'
import { useState } from 'react'

const TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/blog', label: 'Blog', icon: Newspaper },
  { href: '/episodes', label: 'Episodes', icon: Clapperboard },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href))

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur md:hidden">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                active ? 'text-primary' : 'text-foreground/60'
              }`}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </Link>
          )
        })}
        <button
          onClick={() => router.push('/episodes/search')}
          className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-foreground/60"
        >
          <Search className="h-5 w-5" />
          Search
        </button>
        <button
          onClick={() => setMoreOpen((s) => !s)}
          className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-foreground/60"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-x-0 bottom-[52px] z-40 border-t border-border bg-background p-4 md:hidden">
          <div className="grid grid-cols-2 gap-2">
            <Link href="/about" onClick={() => setMoreOpen(false)} className="rounded-lg border border-border p-3 text-sm">
              About
            </Link>
            <Link href="/contact" onClick={() => setMoreOpen(false)} className="rounded-lg border border-border p-3 text-sm">
              Contact
            </Link>
            <Link href="/privacy" onClick={() => setMoreOpen(false)} className="rounded-lg border border-border p-3 text-sm">
              Privacy Policy
            </Link>
            <Link href="/terms" onClick={() => setMoreOpen(false)} className="rounded-lg border border-border p-3 text-sm">
              Terms
            </Link>
          </div>
        </div>
      )}
    </>
  )
}