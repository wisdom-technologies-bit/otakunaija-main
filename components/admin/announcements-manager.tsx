"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { clearAnnouncement, setAnnouncementActive } from "@/app/actions/announcements"
import { describeTarget } from "@/lib/announcements/targeting"
import type { AdminAnnouncement, AnnouncementSlot } from "@/lib/announcements/types"
import { AnnouncementEditor } from "./announcement-editor"

type Slots = Record<AnnouncementSlot, AdminAnnouncement | null>

function windowLabel(a: AdminAnnouncement): string | null {
  const now = Date.now()
  if (a.startsAt && new Date(a.startsAt).getTime() > now) return `Starts ${new Date(a.startsAt).toLocaleString()}`
  if (a.endsAt) {
    const end = new Date(a.endsAt)
    return end.getTime() <= now ? `Expired ${end.toLocaleString()}` : `Ends ${end.toLocaleString()}`
  }
  return null
}

export function AnnouncementsManager({ initial }: { initial: Slots }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  // null = list view; "new" or a slot number = editor
  const [editing, setEditing] = useState<AnnouncementSlot | "new" | null>(null)

  const slots = initial
  const used = ([1, 2] as const).filter((s) => slots[s])
  const full = used.length === 2

  const done = () => {
    setEditing(null)
    router.refresh()
  }

  const toggle = (a: AdminAnnouncement) =>
    start(async () => {
      const r = await setAnnouncementActive(a.slot as AnnouncementSlot, !a.isActive)
      if (r.ok) {
        toast.success(a.isActive ? "Announcement deactivated" : "Announcement is live")
        router.refresh()
      } else toast.error(r.error)
    })

  const remove = (a: AdminAnnouncement) => {
    if (!window.confirm("Delete this announcement? Visitors will stop seeing it.")) return
    start(async () => {
      const r = await clearAnnouncement(a.slot as AnnouncementSlot)
      if (r.ok) {
        toast.success("Announcement deleted")
        router.refresh()
      } else toast.error(r.error)
    })
  }

  if (editing !== null) {
    const existing = editing === "new" ? null : slots[editing]
    // Editing the "new" form when both slots are full overwrites the oldest one.
    const overwriteTarget =
      editing === "new" && full
        ? new Date(slots[1]!.updatedAt) <= new Date(slots[2]!.updatedAt)
          ? slots[1]
          : slots[2]
        : null
    return <AnnouncementEditor slot={editing} existing={existing} overwriteTarget={overwriteTarget} onDone={done} onCancel={() => setEditing(null)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {used.length}/2 slots used{full ? " — a new announcement overwrites the oldest" : ""}
        </p>
        <Button onClick={() => setEditing("new")}>
          <Plus className="mr-1.5 h-4 w-4" /> New announcement
        </Button>
      </div>

      {used.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No announcements yet. Create your first one.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {used.map((s) => {
            const a = slots[s]!
            const win = windowLabel(a)
            const live = a.isActive && !(win && /^(Starts|Expired)/.test(win))
            return (
              <section key={s} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={live ? "default" : "secondary"}>{live ? "Live" : a.isActive ? "Scheduled / expired" : "Inactive"}</Badge>
                  <span className="text-xs text-muted-foreground">Slot {s} · v{a.revision}</span>
                  {win ? <span className="text-xs text-muted-foreground">· {win}</span> : null}
                </div>
                <div>
                  <h2 className="font-semibold">{a.title || "Untitled announcement"}</h2>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{a.bodyMarkdown}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {a.targets.map((t) => (
                    <span key={t} className="rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-xs">
                      {describeTarget(t)}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                    <Pencil className="mr-1.5 h-4 w-4" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => toggle(a)}>
                    {a.isActive ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
                    {a.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => remove(a)}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                  </Button>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
