import Link from "next/link"
import { FileText, Eye, Users, Mail, Plus, ArrowRight, Folder, Film } from "lucide-react"
import { getAdminStats, getAdminPosts } from "@/lib/admin-queries"
import { getAllCreators, getAllSeriesForAdmin, getAllEpisodesForAdmin } from "@/lib/db/queries"
import { formatDate } from "@/lib/posts"

export const metadata = { title: "Dashboard" }

export default async function AdminDashboard() {
  const [stats, posts, creators, seriesData, episodesData] = await Promise.all([
    getAdminStats(),
    getAdminPosts(),
    getAllCreators(),
    getAllSeriesForAdmin(),
    getAllEpisodesForAdmin(),
  ])
  const recent = posts.slice(0, 5)

  const cards = [
    { label: "Total Posts", value: stats.totalPosts, icon: FileText, href: "/admin/posts" },
    { label: "Total Views", value: stats.totalViews.toLocaleString(), icon: Eye, href: "/admin/posts" },
    { label: "Total Series", value: seriesData.length, icon: Folder, href: "/admin/series" },
    { label: "Total Episodes", value: episodesData.length, icon: Film, href: "/admin/episodes" },
    { label: "Subscribers", value: stats.totalSubscribers, icon: Users, href: "/admin/subscribers" },
    { label: "Messages", value: stats.totalMessages, icon: Mail, href: "/admin/messages" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back. Here&apos;s how OtakuNaija is doing today.</p>
        </div>
        <Link
          href="/admin/posts/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Post
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Link
              key={c.label}
              href={c.href}
              className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </span>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 font-display text-2xl font-bold">{c.value}</div>
            </Link>
          )
        })}
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-display text-base font-semibold">Recent Posts</h2>
          <Link
            href="/admin/posts"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {recent.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No posts yet.{" "}
              <Link href="/admin/posts/new" className="text-primary hover:underline">
                Create your first post
              </Link>
              .
            </div>
          ) : (
            recent.map((p) => (
              <Link
                key={p.id}
                href={`/admin/posts/${p.id}/edit`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-background/50"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 text-sm font-medium">{p.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.category} · {formatDate(p.published_at)} · {p.views.toLocaleString()} views
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {p.featured ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Featured
                    </span>
                  ) : null}
                  {p.trending ? (
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-500">
                      Trending
                    </span>
                  ) : null}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
