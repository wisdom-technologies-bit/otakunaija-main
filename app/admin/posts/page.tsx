import Link from "next/link"
import { Plus, Eye, Pencil } from "lucide-react"
import { getAdminPosts } from "@/lib/admin-queries"
import { formatDate } from "@/lib/posts"
import { DeletePostButton } from "@/components/admin/delete-post-button"

export const metadata = { title: "Posts" }

export default async function AdminPostsPage() {
  const posts = await getAdminPosts()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Posts</h1>
          <p className="text-sm text-muted-foreground">{posts.length} total</p>
        </div>
        <Link
          href="/admin/posts/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Post
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {posts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">No posts yet.</p>
            <Link
              href="/admin/posts/new"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Create your first post
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {posts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/posts/${p.id}/edit`}
                      className="line-clamp-1 text-sm font-semibold hover:text-primary"
                    >
                      {p.title}
                    </Link>
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
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.category} · {formatDate(p.published_at)} · {p.views.toLocaleString()} views · /{p.slug}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/blog/${p.slug}`}
                    target="_blank"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                    aria-label="View post"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/admin/posts/${p.id}/edit`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                    aria-label="Edit post"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <DeletePostButton id={p.id} title={p.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
