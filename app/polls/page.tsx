import Link from 'next/link'
import { BarChart3, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PollCard } from '@/components/poll-card'
import { AdSlot } from '@/components/ad-slot'
import { Button } from '@/components/ui/button'
import { getPublicPolls } from '@/lib/db/queries/polls'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Anime Polls — Vote & Have Your Say | OtakuNaija',
  description: 'Vote in the latest anime polls, share your opinion, and see what the OtakuNaija community thinks.',
  alternates: { canonical: '/polls' },
  openGraph: { title: 'Anime Polls — OtakuNaija', description: 'Have your say in the latest anime debates.', type: 'website', url: '/polls' },
}

type Filter = 'all' | 'active' | 'upcoming' | 'ended'

export default async function PollsPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; page?: string }> }) {
  const params = await searchParams
  const filter: Filter = ['all', 'active', 'upcoming', 'ended'].includes(params.filter || '') ? params.filter as Filter : 'active'
  const query = typeof params.q === 'string' ? params.q : ''
  const page = Math.max(1, Number.parseInt(params.page || '1', 10) || 1)
  const result = await getPublicPolls({ filter, query, page, pageSize: 12 })
  const pageCount = Math.ceil(result.total / result.pageSize)
  const makeUrl = (nextPage: number, nextFilter = filter) => {
    const search = new URLSearchParams()
    if (nextFilter !== 'active') search.set('filter', nextFilter)
    if (query) search.set('q', query)
    if (nextPage > 1) search.set('page', String(nextPage))
    const value = search.toString()
    return `/polls${value ? `?${value}` : ''}`
  }

  return <div className="flex min-h-dvh flex-col">
    <SiteHeader />
    <main className="flex-1">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <section className="border-b border-border pb-8">
          <div className="flex items-center gap-2 text-primary"><BarChart3 className="size-5" aria-hidden="true" /><span className="text-xs font-semibold uppercase tracking-wider">Community picks</span></div>
          <h1 className="mt-3 font-display text-3xl font-bold md:text-5xl">Anime Polls</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Have your say on the characters, moments, and stories the OtakuNaija community loves most.</p>
        </section>

        <div className="my-6"><AdSlot slot="header" /></div>

        <section className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
          <nav aria-label="Poll filters" className="flex flex-wrap gap-2">
            {(['active', 'all', 'upcoming', 'ended'] as Filter[]).map((item) => <Link key={item} href={makeUrl(1, item)} className={`rounded-full border px-4 py-2 text-sm capitalize transition-colors ${filter === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary hover:text-primary'}`}>{item}</Link>)}
          </nav>
          <form action="/polls" className="flex w-full max-w-sm gap-2">
            <input type="hidden" name="filter" value={filter} />
            <label className="sr-only" htmlFor="poll-search">Search polls</label>
            <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input id="poll-search" name="q" defaultValue={query} placeholder="Search polls..." className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
            <Button type="submit" variant="outline">Search</Button>
          </form>
        </section>

        <section className="pt-8" aria-labelledby="poll-list-heading">
          <div className="mb-5 flex items-end justify-between gap-4"><div><h2 id="poll-list-heading" className="font-display text-2xl font-bold md:text-3xl">{filter === 'active' ? 'Active Polls' : filter === 'upcoming' ? 'Upcoming Polls' : filter === 'ended' ? 'Poll Archive' : 'All Public Polls'}</h2><p className="mt-1 text-sm text-muted-foreground">{result.total} {result.total === 1 ? 'poll' : 'polls'}{query ? ` matching “${query}”` : ''}</p></div></div>
          {result.polls.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{result.polls.map((poll) => <PollCard key={poll.id} poll={poll} />)}</div> : <div className="rounded-xl border border-dashed border-border p-12 text-center"><h3 className="font-display text-lg font-bold">{query ? `No polls found for “${query}”` : filter === 'active' ? 'No active polls right now' : 'No polls found in this category'}</h3><p className="mt-2 text-sm text-muted-foreground">{query ? 'Try a different search or browse all polls.' : 'Check back soon for the next community poll.'}</p>{query ? <Button asChild variant="outline" className="mt-5"><Link href="/polls">Browse all polls</Link></Button> : null}</div>}
        </section>

        {pageCount > 1 ? <nav aria-label="Poll pagination" className="mt-8 flex items-center justify-center gap-3"><Button asChild variant="outline" size="sm" disabled={page <= 1}><Link href={makeUrl(page - 1)}><ChevronLeft className="size-4" /> Previous</Link></Button><span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span><Button asChild variant="outline" size="sm" disabled={page >= pageCount}><Link href={makeUrl(page + 1)}>Next <ChevronRight className="size-4" /></Link></Button></nav> : null}
      </div>
    </main>
    <SiteFooter />
  </div>
}
