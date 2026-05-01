import { getAllSubscribers } from "@/lib/admin-queries"
import { formatDate } from "@/lib/posts"

export const metadata = { title: "Subscribers" }

export default async function SubscribersPage() {
  const subs = await getAllSubscribers()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Subscribers</h1>
        <p className="text-sm text-muted-foreground">{subs.length} email{subs.length === 1 ? "" : "s"} on the list</p>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {subs.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No subscribers yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="text-sm font-medium">{s.email}</span>
                <time dateTime={s.subscribed_at} className="text-xs text-muted-foreground">
                  {formatDate(s.subscribed_at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
