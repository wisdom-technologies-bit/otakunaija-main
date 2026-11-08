'use client'

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Newspaper, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NewsAutomationPanel } from "@/components/admin/news-automation-panel"
import { formatRelativeTime } from "@/lib/posts"

type NewsItem = {
  id: string | number
  title: string
  summary?: string | null
  source?: string | null
  published_at: string
  image_url?: string | null
  link?: string | null
  original_link?: string | null
  full_content?: string | null
}

type NewsResponse = {
  items?: NewsItem[]
  data?: NewsItem[] | { items?: NewsItem[]; results?: NewsItem[]; totalPages?: number; hasNextPage?: boolean }
  results?: NewsItem[]
  totalPages?: number
  total_pages?: number
  hasNextPage?: boolean
  has_next_page?: boolean
  page?: number
}

function parseNewsResponse(payload: NewsResponse) {
  const nested = payload.data && !Array.isArray(payload.data) ? payload.data : undefined
  const items = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.results)
      ? payload.results
      : Array.isArray(payload.data)
        ? payload.data
        : nested?.items ?? nested?.results ?? []
  const totalPages = payload.totalPages ?? payload.total_pages ?? nested?.totalPages
  const hasNextPage = payload.hasNextPage ?? payload.has_next_page ?? nested?.hasNextPage
  return { items, totalPages, hasNextPage }
}

export default function AdminPostsLatestPage() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState<number | undefined>()
  const [hasNextPage, setHasNextPage] = useState(false)
  const [expandedId, setExpandedId] = useState<string | number | null>(null)
  const [detail, setDetail] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | number | null>(null)
  const [error, setError] = useState(false)

  const loadItems = useCallback(async (nextPage: number) => {
    setLoading(true)
    setError(false)
    try {
      const response = await fetch(`/api/admin/news/list?page=${nextPage}`, { cache: "no-store" })
      if (!response.ok) throw new Error("Unable to load headlines")
      const parsed = parseNewsResponse((await response.json()) as NewsResponse)
      setItems(parsed.items)
      setTotalPages(parsed.totalPages)
      setHasNextPage(parsed.hasNextPage ?? (parsed.totalPages ? nextPage < parsed.totalPages : parsed.items.length > 0))
      setPage(nextPage)
      setExpandedId(null)
      setDetail(null)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems(1)
  }, [loadItems])

  async function toggleDetail(item: NewsItem) {
    if (expandedId === item.id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(item.id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const response = await fetch(`/api/admin/news/${encodeURIComponent(String(item.id))}`, { cache: "no-store" })
      if (!response.ok) throw new Error("Unable to load headline")
      const payload = await response.json()
      setDetail((payload.item ?? payload.data ?? payload) as NewsItem)
    } catch {
      toast.error("Could not load headline details.")
      setExpandedId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function deleteItem(id: string | number) {
    setDeletingId(id)
    try {
      const response = await fetch(`/api/admin/news/${encodeURIComponent(String(id))}/delete`, { method: "POST" })
      if (!response.ok) throw new Error("Unable to delete headline")
      setItems((current) => current.filter((item) => item.id !== id))
      if (expandedId === id) {
        setExpandedId(null)
        setDetail(null)
      }
      toast.success("Removed from queue.")
    } catch {
      toast.error("Could not remove headline.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Tabs defaultValue="headlines" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="size-5 text-primary" aria-hidden="true" />
            <h1 className="font-display text-2xl font-bold md:text-3xl">Latest Headlines</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Review news from Anime News Network before turning it into a post.</p>
        </div>
        <Badge variant="secondary">Page {page}{totalPages ? ` of ${totalPages}` : ""}</Badge>
      </header>

      <TabsList>
        <TabsTrigger value="headlines">
          <Newspaper aria-hidden="true" /> ANN headlines
        </TabsTrigger>
        <TabsTrigger value="automation">
          <Sparkles aria-hidden="true" /> Automation
        </TabsTrigger>
      </TabsList>

      <TabsContent value="headlines" className="flex flex-col gap-5">

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="font-medium">We couldn&apos;t load the latest headlines.</p>
          <p className="mt-1 text-sm text-muted-foreground">The news service may be temporarily unavailable.</p>
          <Button className="mt-4" onClick={() => void loadItems(page)}>Retry</Button>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-3" aria-label="Loading headlines">
          {[1, 2, 3].map((key) => <Skeleton key={key} className="h-24 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Empty className="rounded-xl border border-border bg-card py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Newspaper /></EmptyMedia>
            <EmptyTitle>No new headlines right now</EmptyTitle>
            <EmptyDescription>Check back later for more stories to review.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id}>
                <div className="flex cursor-pointer flex-wrap items-start gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5" onClick={() => void toggleDetail(item)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void toggleDetail(item) } }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="line-clamp-2 text-sm font-semibold">{item.title}</h2>
                      <Badge variant="outline" className="text-[10px] uppercase">{item.source || "ANN"}</Badge>
                    </div>
                    {item.summary ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p> : null}
                    <time dateTime={item.published_at} className="mt-2 block text-xs text-muted-foreground">{formatRelativeTime(item.published_at)}</time>
                  </div>
                  <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={deletingId === item.id} onClick={(event) => { event.stopPropagation(); void deleteItem(item.id) }}>
                    {deletingId === item.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                    <span className="sr-only sm:not-sr-only">Delete</span>
                  </Button>
                </div>
                {expandedId === item.id ? (
                  <div className="border-t border-border bg-muted/20 px-4 py-5 sm:px-5">
                    {detailLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Loading details…</div> : detail ? (
                      <div className="flex flex-col gap-4">
                        {detail.image_url ? <img src={detail.image_url} alt="" className="h-32 w-56 rounded-lg object-cover" /> : null}
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">{detail.full_content || "No full content available."}</p>
                        {(detail.original_link || detail.link) ? <Link href={detail.original_link || detail.link || "#"} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline">View original on Anime News Network <ExternalLink aria-hidden="true" /></Link> : null}
                        <div className="flex flex-wrap gap-2">
                          <Button asChild><Link href={`/admin/posts/new?newsId=${encodeURIComponent(String(item.id))}`}>Insert</Link></Button>
                          <Button type="button" variant="destructive" disabled={deletingId === item.id} onClick={() => void deleteItem(item.id)}><Trash2 aria-hidden="true" /> Delete</Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!error && !loading && items.length > 0 ? <nav className="flex items-center justify-between" aria-label="Headline pagination">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void loadItems(page - 1)}><ChevronLeft aria-hidden="true" /> Previous</Button>
        <span className="text-sm text-muted-foreground">Page {page}{totalPages ? ` of ${totalPages}` : ""}</span>
        <Button variant="outline" size="sm" disabled={!hasNextPage} onClick={() => void loadItems(page + 1)}>Next <ChevronRight aria-hidden="true" /></Button>
      </nav> : null}
      </TabsContent>

      <TabsContent value="automation" className="flex flex-col gap-5">
        <NewsAutomationPanel />
      </TabsContent>
    </Tabs>
  )
}

