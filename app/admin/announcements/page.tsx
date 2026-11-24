import { AlertTriangle } from "lucide-react"
import { getAdminAnnouncements } from "@/lib/announcements/queries"
import { AnnouncementsManager } from "@/components/admin/announcements-manager"

export const metadata = { title: "Announcements" }
export const dynamic = "force-dynamic"

export default async function AnnouncementsPage() {
  const { slots, tableMissing, error } = await getAdminAnnouncements()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Announcements</h1>
        <p className="text-sm text-muted-foreground">
          Write a message, pick the pages it appears on, and visitors see a full-screen “News announcement” once per page — then a
          shaking bell. You can keep up to two announcements; saving a third overwrites the oldest.
        </p>
      </div>

      {tableMissing ? (
        <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold">The announcements table doesn’t exist yet.</p>
            <p className="mt-1 text-muted-foreground">
              Open the Neon SQL editor and run <code className="rounded bg-secondary px-1.5 py-0.5">docs/sql/announcements.sql</code> once,
              then refresh this page.
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">Couldn’t load announcements: {error}</div>
      ) : (
        <AnnouncementsManager initial={slots} />
      )}
    </div>
  )
}
