"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { Bell, Megaphone, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { matchesTargets, seenPageKey } from "@/lib/announcements/targeting"
import type { PublicAnnouncement } from "@/lib/announcements/types"
import { AnnouncementView } from "./announcement-view"

const STORAGE_PREFIX = "otakunaija-announcement:"
const SHAKE_EVERY_MS = 10_000
const SHAKE_DURATION_MS = 900
const CACHE_TTL_MS = 60_000

type SeenRecord = { pages: string[]; site: boolean }

// ---- tiny, failure-proof localStorage helpers (private mode / blocked storage) ----
function seenKey(a: Pick<PublicAnnouncement, "slot" | "revision">) {
  return `${STORAGE_PREFIX}${a.slot}:r${a.revision}`
}

function readSeen(a: PublicAnnouncement): SeenRecord {
  try {
    const raw = localStorage.getItem(seenKey(a))
    if (!raw) return { pages: [], site: false }
    const parsed = JSON.parse(raw) as Partial<SeenRecord>
    return {
      pages: Array.isArray(parsed.pages) ? parsed.pages.filter((p) => typeof p === "string").slice(0, 500) : [],
      site: parsed.site === true,
    }
  } catch {
    return { pages: [], site: false }
  }
}

function writeSeen(a: PublicAnnouncement, page: string) {
  try {
    const cur = readSeen(a)
    const pages = cur.pages.includes(page) ? cur.pages : [...cur.pages, page].slice(-500)
    localStorage.setItem(seenKey(a), JSON.stringify({ pages, site: true } satisfies SeenRecord))
  } catch {
    /* storage unavailable — the cover will simply show again next visit */
  }
}

function hasSeen(a: PublicAnnouncement, page: string): boolean {
  const s = readSeen(a)
  return a.seenScope === "site" ? s.site : s.pages.includes(page)
}

/** Drop seen-records for revisions that no longer exist, so storage doesn't grow forever. */
function pruneOldRecords(current: PublicAnnouncement[]) {
  try {
    const keep = new Set(current.map(seenKey))
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith(STORAGE_PREFIX) && !keep.has(k)) localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
}

// ---- one network request per tab, shared across client-side navigations ----
let cache: { at: number; data: PublicAnnouncement[] } | null = null
let inflight: Promise<PublicAnnouncement[]> | null = null

function loadAnnouncements(): Promise<PublicAnnouncement[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return Promise.resolve(cache.data)
  if (inflight) return inflight
  inflight = fetch("/api/announcements", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? (r.json() as Promise<{ announcements?: PublicAnnouncement[] }>) : { announcements: [] }))
    .then((j) => {
      const data = Array.isArray(j.announcements) ? j.announcements : []
      cache = { at: Date.now(), data }
      pruneOldRecords(data)
      return data
    })
    .catch(() => cache?.data ?? [])
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function AnnouncementHost() {
  const pathname = usePathname() || "/"
  const [all, setAll] = useState<PublicAnnouncement[]>([])
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [coverDismissed, setCoverDismissed] = useState(false)
  const [seenTick, setSeenTick] = useState(0)
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    setMounted(true)
    let alive = true
    loadAnnouncements().then((data) => alive && setAll(data))
    return () => {
      alive = false
    }
  }, [])

  // Refresh when the tab regains focus so a new/changed announcement appears without a hard reload.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      loadAnnouncements().then((data) => setAll(data))
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  const page = seenPageKey(pathname)

  // Active + inside its schedule window + targeted at this page.
  const matching = useMemo(() => {
    const now = Date.now()
    return all.filter((a) => {
      if (a.startsAt && new Date(a.startsAt).getTime() > now) return false
      if (a.endsAt && new Date(a.endsAt).getTime() <= now) return false
      return matchesTargets(pathname, a.targets)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, pathname, seenTick])

  // Re-evaluate on every navigation.
  useEffect(() => {
    setOpen(false)
    setCoverDismissed(false)
  }, [pathname])

  const unseen = useMemo(
    () => (mounted ? matching.filter((a) => !hasSeen(a, page)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matching, page, mounted, seenTick],
  )

  const markAllSeen = useCallback(() => {
    for (const a of matching) writeSeen(a, page)
    setSeenTick((n) => n + 1)
  }, [matching, page])

  const showCover = unseen.length > 0 && !coverDismissed && !open
  const showBell = matching.length > 0 && !showCover

  // Lock page scroll while the full-screen cover is up.
  useEffect(() => {
    if (!showCover) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [showCover])

  // Esc closes the cover (counts as seen).
  useEffect(() => {
    if (!showCover) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        markAllSeen()
        setCoverDismissed(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showCover, markAllSeen])

  // Bell shakes every 10 seconds (CSS-driven; skipped for reduced-motion users via CSS).
  useEffect(() => {
    if (!showBell) return
    let off: ReturnType<typeof setTimeout> | undefined
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return
      setShaking(true)
      off = setTimeout(() => setShaking(false), SHAKE_DURATION_MS)
    }, SHAKE_EVERY_MS)
    return () => {
      clearInterval(id)
      if (off) clearTimeout(off)
      setShaking(false)
    }
  }, [showBell])

  const openAnnouncements = () => {
    markAllSeen()
    setOpen(true)
  }

  if (!mounted || matching.length === 0) return null

  return (
    <>
      {showCover ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-cover-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-md motion-safe:animate-in motion-safe:fade-in"
        >
          <button
            type="button"
            aria-label="Dismiss announcement"
            onClick={() => {
              markAllSeen()
              setCoverDismissed(true)
            }}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground/80 transition-colors hover:text-foreground sm:right-5 sm:top-5"
            style={{ marginTop: "env(safe-area-inset-top)" }}
          >
            <X className="h-5 w-5" />
          </button>

          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 text-center shadow-2xl motion-safe:animate-in motion-safe:zoom-in-95">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary ring-8 ring-primary/10">
              <Megaphone className="h-8 w-8" aria-hidden />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Announcement</p>
            <h2 id="announcement-cover-title" className="mt-1 font-display text-2xl font-bold">
              News announcement
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {unseen.length > 1 ? `You have ${unseen.length} new announcements.` : "We have something new to share with you."}
            </p>
            <button
              type="button"
              autoFocus
              onClick={openAnnouncements}
              className="mt-6 w-full rounded-xl bg-primary px-5 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:bg-primary/90 active:scale-[0.98]"
            >
              Click to view
            </button>
            <button
              type="button"
              onClick={() => {
                markAllSeen()
                setCoverDismissed(true)
              }}
              className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Maybe later
            </button>
          </div>
        </div>
      ) : null}

      {showBell ? (
        <button
          type="button"
          onClick={openAnnouncements}
          aria-label={matching.length > 1 ? `View ${matching.length} announcements` : "View announcement"}
          // Mobile: sits above the 52px bottom tab bar + the iOS home indicator. Desktop: normal corner offset.
          className="fixed left-3 z-[60] flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card/95 text-primary shadow-lg shadow-black/40 backdrop-blur transition-transform hover:scale-105 active:scale-95 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] md:bottom-6 md:left-6 md:h-14 md:w-14"
        >
          <Bell className={`h-6 w-6 md:h-7 md:w-7 origin-top ${shaking ? "announcement-bell-shake" : ""}`} aria-hidden />
          {matching.length > 1 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
              {matching.length}
            </span>
          ) : null}
        </button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogTitle className="flex items-center gap-2 font-display">
            <Megaphone className="h-5 w-5 text-primary" aria-hidden />
            {matching.length > 1 ? "Announcements" : "Announcement"}
          </DialogTitle>
          <DialogDescription className="sr-only">News and updates from OtakuNaija</DialogDescription>
          <div className="divide-y divide-border [&>*]:py-5 first:[&>*]:pt-0 last:[&>*]:pb-0">
            {matching.map((a) => (
              <AnnouncementView key={a.slot} announcement={a} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
