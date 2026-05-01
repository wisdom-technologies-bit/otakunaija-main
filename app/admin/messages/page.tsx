import { getAllMessages } from "@/lib/admin-queries"
import { formatDate } from "@/lib/posts"

export const metadata = { title: "Messages" }

export default async function MessagesPage() {
  const messages = await getAllMessages()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Messages</h1>
        <p className="text-sm text-muted-foreground">{messages.length} message{messages.length === 1 ? "" : "s"} received</p>
      </div>
      <div className="space-y-3">
        {messages.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No messages yet.
          </p>
        ) : (
          messages.map((m) => (
            <article key={m.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{m.name}</h2>
                  <a href={`mailto:${m.email}`} className="text-xs text-primary hover:underline">
                    {m.email}
                  </a>
                </div>
                <time dateTime={m.created_at} className="text-xs text-muted-foreground">
                  {formatDate(m.created_at)}
                </time>
              </div>
              {m.subject ? <p className="mt-2 text-sm font-medium">Subject: {m.subject}</p> : null}
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">{m.message}</p>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
