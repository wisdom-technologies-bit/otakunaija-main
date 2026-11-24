"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Bold, Heading2, ImagePlus, Italic, Link2, List, Loader2, Quote, Search, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { saveAnnouncement } from "@/app/actions/announcements"
import { OTHER_PAGES, describeTarget, isValidTargetKey } from "@/lib/announcements/targeting"
import { MAX_BODY_LENGTH, type AdminAnnouncement, type AnnouncementSlot } from "@/lib/announcements/types"
import { AnnouncementView } from "@/components/announcements/announcement-view"

type Props = {
  slot: AnnouncementSlot | "new"
  existing: AdminAnnouncement | null
  /** When saving a new announcement into a full table: the one that will be replaced. */
  overwriteTarget: AdminAnnouncement | null
  onDone: () => void
  onCancel: () => void
}

type Option = { key: string; label: string; hint?: string }

/** ISO <-> <input type="datetime-local"> (local time, no seconds). */
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null
}

const FIXED = [
  { key: "home", label: "Home page", hint: "/" },
  { key: "episodes", label: "Episodes", hint: "/episodes" },
  { key: "blog", label: "Blog index", hint: "/blog" },
  { key: "blog-post:*", label: "Every blog post", hint: "/blog/<slug>" },
  { key: "series:*", label: "Every series page", hint: "/episodes/<series>" },
  { key: "episode:*", label: "Every episode page", hint: "/episodes/<series>/<episode>" },
]

export function AnnouncementEditor({ slot, existing, overwriteTarget, onDone, onCancel }: Props) {
  const [pending, start] = useTransition()
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(existing?.title ?? "")
  const [body, setBody] = useState(existing?.bodyMarkdown ?? "")
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? "")
  const [ctaLabel, setCtaLabel] = useState(existing?.ctaLabel ?? "")
  const [ctaUrl, setCtaUrl] = useState(existing?.ctaUrl ?? "")
  const [isActive, setIsActive] = useState(existing?.isActive ?? true)
  const [seenScope, setSeenScope] = useState<"page" | "site">(existing?.seenScope ?? "page")
  const [targets, setTargets] = useState<string[]>(existing?.targets ?? [])
  const [startsAt, setStartsAt] = useState(toLocalInput(existing?.startsAt ?? null))
  const [endsAt, setEndsAt] = useState(toLocalInput(existing?.endsAt ?? null))
  const [resetSeen, setResetSeen] = useState(false)
  const [tab, setTab] = useState<"write" | "preview">("write")
  const [uploading, setUploading] = useState(false)
  const [customPath, setCustomPath] = useState("")

  const all = targets.includes("all")
  const has = (k: string) => targets.includes(k)
  const toggleTarget = (k: string) => setTargets((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t.filter((x) => x !== "all"), k]))
  const addTarget = (k: string) => setTargets((t) => (t.includes(k) ? t : [...t.filter((x) => x !== "all"), k]))

  // ---- markdown toolbar ----
  const wrap = (before: string, after = before, placeholder = "text") => {
    const el = bodyRef.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const sel = body.slice(s, e) || placeholder
    const next = body.slice(0, s) + before + sel + after + body.slice(e)
    setBody(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + before.length, s + before.length + sel.length)
    })
  }
  const linePrefix = (prefix: string) => {
    const el = bodyRef.current
    if (!el) return
    const s = el.selectionStart
    const lineStart = body.lastIndexOf("\n", s - 1) + 1
    setBody(body.slice(0, lineStart) + prefix + body.slice(lineStart))
    requestAnimationFrame(() => el.focus())
  }

  const upload = async (file: File, intoBody: boolean) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed")
      if (intoBody) {
        const el = bodyRef.current
        const pos = el?.selectionStart ?? body.length
        setBody((b) => `${b.slice(0, pos)}\n\n![${file.name.replace(/\.[^.]+$/, "")}](${data.url})\n\n${b.slice(pos)}`)
      } else setImageUrl(data.url)
      toast.success("Image uploaded")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }
  const [uploadInto, setUploadInto] = useState<"cover" | "body">("cover")

  const onSave = () => {
    start(async () => {
      const r = await saveAnnouncement(slot, {
        title,
        bodyMarkdown: body,
        imageUrl,
        ctaLabel,
        ctaUrl,
        isActive,
        targets,
        seenScope,
        startsAt: fromLocalInput(startsAt),
        endsAt: fromLocalInput(endsAt),
        resetSeen,
      })
      if (r.ok) {
        toast.success(r.overwrote ? "Saved (replaced the oldest announcement)" : "Announcement saved")
        onDone()
      } else toast.error(r.error)
    })
  }

  const canSave = body.trim().length > 0 && targets.length > 0 && targets.every(isValidTargetKey)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">
          {slot === "new" ? "New announcement" : `Edit announcement (slot ${slot})`}
        </h2>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {overwriteTarget ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Both slots are in use. Saving will <strong>replace</strong> “{overwriteTarget.title || overwriteTarget.bodyMarkdown.slice(0, 40)}” (the
          oldest). To keep it, cancel and edit a different one.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-5">
          {/* ---- message ---- */}
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Headline (optional)</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. New episodes every Friday" />
            </label>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">Message (Markdown)</span>
                <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
                  {(["write", "preview"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={`rounded px-3 py-1 font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {tab === "write" ? (
                <>
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {[
                      { i: Bold, l: "Bold", f: () => wrap("**") },
                      { i: Italic, l: "Italic", f: () => wrap("*") },
                      { i: Heading2, l: "Heading", f: () => linePrefix("## ") },
                      { i: List, l: "List", f: () => linePrefix("- ") },
                      { i: Quote, l: "Quote", f: () => linePrefix("> ") },
                      { i: Link2, l: "Link", f: () => wrap("[", "](https://)", "link text") },
                    ].map(({ i: Icon, l, f }) => (
                      <Button key={l} type="button" size="icon" variant="outline" className="h-8 w-8" title={l} aria-label={l} onClick={f}>
                        <Icon className="h-4 w-4" />
                      </Button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={uploading}
                      onClick={() => {
                        setUploadInto("body")
                        fileRef.current?.click()
                      }}
                    >
                      {uploading && uploadInto === "body" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}
                      Insert image
                    </Button>
                  </div>
                  <Textarea
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    maxLength={MAX_BODY_LENGTH}
                    className="font-mono text-sm"
                    placeholder={"We just launched **new episodes**!\n\n- Item one\n- Item two\n\n[Read more](/blog)"}
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {body.length.toLocaleString()} / {MAX_BODY_LENGTH.toLocaleString()}
                  </p>
                </>
              ) : (
                <div className="min-h-48 rounded-lg border border-border bg-background p-4">
                  {body.trim() ? (
                    <AnnouncementView announcement={{ title: title || null, bodyMarkdown: body, imageUrl: imageUrl || null, ctaLabel: ctaLabel || null, ctaUrl: ctaUrl || null }} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                  )}
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void upload(f, uploadInto === "body")
                e.target.value = ""
              }}
            />

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Cover image (optional)</span>
              <div className="flex flex-wrap items-center gap-2">
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://… or upload" className="min-w-0 flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => {
                    setUploadInto("cover")
                    fileRef.current?.click()
                  }}
                >
                  {uploading && uploadInto === "cover" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}
                  Upload
                </Button>
                {imageUrl ? (
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove image" onClick={() => setImageUrl("")}>
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Button label (optional)</span>
                <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={60} placeholder="Watch now" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Button link</span>
                <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/episodes or https://…" />
              </label>
            </div>
          </section>

          {/* ---- targeting ---- */}
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="font-semibold">Where should it appear?</h3>
              <p className="text-xs text-muted-foreground">It only ever shows on the pages you select here.</p>
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--primary)]"
                checked={all}
                onChange={(e) => setTargets(e.target.checked ? ["all"] : [])}
              />
              <span className="text-sm font-medium">All pages</span>
            </label>

            <div className={all ? "pointer-events-none space-y-4 opacity-40" : "space-y-4"}>
              <div className="grid gap-2 sm:grid-cols-2">
                {FIXED.map((o) => (
                  <label key={o.key} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={has(o.key)} onChange={() => toggleTarget(o.key)} />
                    <span className="min-w-0">
                      <span className="block text-sm">{o.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              <TargetPicker kind="blog-post" title="Specific blog posts" onPick={addTarget} />
              <TargetPicker kind="series" title="Specific series (or all episodes of a series)" onPick={addTarget} />
              <TargetPicker kind="episode" title="Specific episodes" onPick={addTarget} />

              <div>
                <p className="mb-2 text-sm font-medium">Other pages</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {OTHER_PAGES.map((o) => (
                    <label key={o.key} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={has(o.key)} onChange={() => toggleTarget(o.key)} />
                      <span className="text-sm">{o.label}</span>
                    </label>
                  ))}
                </div>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const raw = customPath.trim()
                    const key = `page:${raw.startsWith("/") ? raw : `/${raw}`}`
                    if (!raw || !isValidTargetKey(key)) return toast.error("Enter a path like /about or /polls/*")
                    addTarget(key)
                    setCustomPath("")
                  }}
                >
                  <Input value={customPath} onChange={(e) => setCustomPath(e.target.value)} placeholder="Custom path, e.g. /about or /polls/*" />
                  <Button type="submit" variant="outline">
                    Add
                  </Button>
                </form>
              </div>
            </div>

            {targets.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                {targets.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 py-0.5 pl-2.5 pr-1 text-xs">
                    {describeTarget(t)}
                    <button type="button" aria-label={`Remove ${describeTarget(t)}`} onClick={() => setTargets((x) => x.filter((y) => y !== t))} className="rounded-full p-0.5 hover:bg-background">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">No pages selected yet.</p>
            )}
          </section>
        </div>

        {/* ---- settings ---- */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-medium">Active</span>
                <span className="block text-xs text-muted-foreground">Inactive announcements never show.</span>
              </span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Full-screen cover shows…</span>
              <select
                value={seenScope}
                onChange={(e) => setSeenScope(e.target.value as "page" | "site")}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="page">Once on each selected page</option>
                <option value="site">Once on the whole site</option>
              </select>
              <span className="block text-xs text-muted-foreground">After that, visitors only see the bell.</span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Starts (optional)</span>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Ends (optional)</span>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>

            {existing ? (
              <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" checked={resetSeen} onChange={(e) => setResetSeen(e.target.checked)} />
                <span className="text-xs text-muted-foreground">
                  Show the full-screen cover again to everyone, even if nothing in the message changed. (Editing the text, image or button does this automatically.)
                </span>
              </label>
            ) : null}

            <Button className="w-full" disabled={pending || !canSave} onClick={onSave}>
              {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {slot === "new" ? "Publish announcement" : "Save changes"}
            </Button>
            {!canSave ? <p className="text-center text-xs text-muted-foreground">Write a message and pick at least one page.</p> : null}
          </section>
        </aside>
      </div>
    </div>
  )
}

/** Debounced search box that lists matching pages and adds one on click. */
function TargetPicker({ kind, title, onPick }: { kind: "blog-post" | "series" | "episode"; title: string; onPick: (key: string) => void }) {
  const [q, setQ] = useState("")
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/announcement-targets?kind=${kind}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        const data = (await res.json()) as { options?: Option[] }
        setOptions(data.options ?? [])
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, kind, open])

  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search by title…"
          className="pl-9"
        />
        {open ? (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl">
            {loading ? <p className="p-3 text-xs text-muted-foreground">Searching…</p> : null}
            {!loading && options.length === 0 ? <p className="p-3 text-xs text-muted-foreground">No matches.</p> : null}
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  onPick(o.key)
                  setOpen(false)
                  setQ("")
                }}
                className="block w-full rounded-md px-3 py-2 text-left hover:bg-accent"
              >
                <span className="block truncate text-sm">{o.label}</span>
                {o.hint ? <span className="block truncate text-[11px] text-muted-foreground">{o.hint}</span> : null}
              </button>
            ))}
            <button type="button" onClick={() => setOpen(false)} className="w-full rounded-md px-3 py-1.5 text-center text-xs text-muted-foreground hover:bg-accent">
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
