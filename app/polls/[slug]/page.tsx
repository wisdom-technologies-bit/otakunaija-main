import { notFound } from 'next/navigation'
import { ArrowLeft, BarChart3, Globe2, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PollCard } from '@/components/poll-card'
import { PollResultsReveal } from '@/components/poll-results-reveal'
import { getPollBySlug, getPollVotes } from '@/lib/db/queries/polls'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const poll = await getPollBySlug((await params).slug)
  if (!poll) return { title: 'Poll not found' }
  return { title: `${poll.title} | OtakuNaija Polls`, description: poll.description || `Vote in the OtakuNaija poll: ${poll.title}`, alternates: { canonical: `/polls/${poll.slug}` }, openGraph: { title: poll.title, description: poll.description || 'Vote with the OtakuNaija community.' } }
}

export default async function PollDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const poll = await getPollBySlug((await params).slug)
  if (!poll) notFound()
  const votes = await getPollVotes(poll.id)
  const open = poll.status === 'ACTIVE' && (!poll.startsAt || new Date() >= poll.startsAt) && (!poll.endsAt || new Date() < poll.endsAt)
  return <div className="flex min-h-dvh flex-col"><SiteHeader /><main className="flex-1"><div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-14"><Link href="/polls" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> All polls</Link><div className="grid gap-8 lg:grid-cols-[1fr_360px]"><div><div className="mb-5 flex items-center gap-2 text-primary"><BarChart3 className="size-5" /><span className="text-xs font-semibold uppercase tracking-wider">{open ? 'Cast your vote' : 'Final results'}</span></div><h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">{poll.title}</h1>{poll.description ? <p className="mt-4 text-lg text-muted-foreground">{poll.description}</p> : null}<div className="mt-8"><PollCard poll={poll} /></div></div><aside className="flex flex-col gap-5"><div className="rounded-xl border border-border bg-card p-5"><h2 className="flex items-center gap-2 font-display text-lg font-bold"><TrendingUp className="size-5 text-primary" /> Results</h2><p className="mt-1 text-sm text-muted-foreground">Results are revealed when you choose to view them.</p><div className="mt-5"><PollResultsReveal options={poll.options} votes={votes} /></div></div><div className="rounded-xl border border-border bg-card p-5"><h2 className="flex items-center gap-2 font-display text-lg font-bold"><Globe2 className="size-5 text-primary" /> Poll stats</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-muted/50 p-3"><div className="text-2xl font-bold">{votes.length}</div><div className="text-muted-foreground">Total votes</div></div><div className="rounded-lg bg-muted/50 p-3"><div className="text-2xl font-bold">{new Set(votes.map((v) => v.countryCode).filter(Boolean)).size}</div><div className="text-muted-foreground">Countries</div></div></div><p className="mt-4 text-xs text-muted-foreground">Locations are approximate and aggregated to protect voter privacy.</p></div></aside></div></div></main><SiteFooter /></div>
}
