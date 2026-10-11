"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, FileText, Mail, Users, LogOut, Plus, ExternalLink, User, Folder, Film, Newspaper, GitMerge } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { logoutAction } from "@/app/actions/admin"
import { ThemeToggle } from "@/components/theme-toggle"

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/posts", label: "Posts", icon: FileText },
  { href: "/admin/posts-latest", label: "Latest Headlines", icon: Newspaper },
  { href: "/admin/creators", label: "Creators", icon: User },
  { href: "/admin/series", label: "Series", icon: Folder },
  { href: "/admin/episodes", label: "Episodes", icon: Film },
  { href: "/admin/videos", label: "Movies & Specials", icon: Film },
  { href: "/admin/subscribers", label: "Subscribers", icon: Users },
  { href: "/admin/messages", label: "Messages", icon: Mail },
  { href: "/admin/anilist-backfill", label: "AniList Matches", icon: GitMerge },
]

export function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href="/admin" className="flex items-center gap-2 font-display text-base font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs">
              ON
            </span>
            <span>
              Otaku<span className="text-primary">Naija</span>
            </span>
            <span className="ml-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground">
              Admin
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View site
            </Link>
            <ThemeToggle />
            <span className="hidden sm:block text-xs text-muted-foreground">{email}</span>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm" className="h-8">
                <LogOut className="h-4 w-4 mr-1.5" /> Logout
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden md:block w-56 flex-shrink-0">
          <nav className="sticky top-20 space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href, item.exact)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/70 hover:bg-card hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
            <Link
              href="/admin/posts/new"
              className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New Post
            </Link>
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="md:hidden mb-4 flex items-center gap-2 overflow-x-auto pb-1">
            {NAV.map((item) => {
              const active = isActive(item.href, item.exact)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground/70",
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
            <Link
              href="/admin/posts/new"
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground whitespace-nowrap"
            >
              + New
            </Link>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
