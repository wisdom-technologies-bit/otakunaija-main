import Link from 'next/link'
import { ArrowRight, BarChart3 } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PollCard } from '@/components/poll-card'
import { getPublicPolls } from '@/lib/db/queries/polls'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Anime Polls', description: 'Vote on the hottest anime debates and see what OtakuNaija readers think.' }

export default async function PollsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const params = await searchParams
  const filter = params.filter === 'active' || params.filter === 'ended' ? params.filter : 'all'
  const polls = await getPublicPolls(filter)
  return <div className="flex min-h-dvh flex-col"><SiteHeader /><main className="flex-1"><div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14"><div className="flex flex-col gap-4 border-b border-border pb-8 md:flex-row md:items-end md:justify-between"><div><div className="mb-3 flex items-center gap-2 text-primary"><BarChart3 className="size-5" /><span className="text-xs font-semibold uppercase tracking-wider">Community picks</span></div><h1 className="font-display text-3xl font-bold md:text-5xl">Anime Polls</h1><p className="mt-3 max-w-xl text-muted-foreground">Have your say on the characters, moments, and stories the community loves most.</p></div><div className="flex gap-2 text-sm">{(['all','active','ended'] as const).map((item) => <Link key={item} href={item === 'all' ? '/polls' : `/polls?filter=${item}`} className={`rounded-full border px-4 py-2 capitalize transition-colors ${filter === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary hover:text-primary'}`}>{item}</Link>)}</div></div><div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{polls.length ? polls.map((poll) => <PollCard key={poll.id} poll={poll} />) : <div className="col-span-full rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">No polls found in this category.</div>}</div></div></main><SiteFooter /></div>
}
