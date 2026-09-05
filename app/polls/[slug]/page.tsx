import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PollDetailClient } from '@/components/poll-detail-client'
import { getPollAnalytics, getPollBySlug } from '@/lib/db/queries/polls'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const poll = await getPollBySlug((await params).slug)
  if (!poll) return { title: 'Poll not found' }
  const description = poll.description || `Vote with the OtakuNaija community in ${poll.title}.`
  return { title: `${poll.title} | OtakuNaija Polls`, description, alternates: { canonical: `/polls/${poll.slug}` }, openGraph: { title: poll.title, description, type: 'article' }, twitter: { card: 'summary', title: poll.title, description } }
}

export default async function PollDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const poll = await getPollBySlug((await params).slug)
  if (!poll) notFound()
  const analytics = await getPollAnalytics(poll.id)
  const now = new Date()
  const open = poll.status === 'ACTIVE' && (!poll.startsAt || now >= poll.startsAt) && (!poll.endsAt || now < poll.endsAt)
  const upcoming = poll.status === 'ACTIVE' && !!poll.startsAt && now < poll.startsAt
  return <div className="flex min-h-dvh flex-col"><SiteHeader/><main className="flex-1"><div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-14"><Link href="/polls" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4"/>All polls</Link>{upcoming?<div className="mb-6 rounded-xl border border-border bg-card p-5"><h1 className="font-display text-3xl font-bold">{poll.title}</h1><p className="mt-2 text-muted-foreground">Voting hasn&apos;t started yet. Check back after {poll.startsAt?.toLocaleString()}.</p></div>:<PollDetailClient poll={poll} analytics={analytics} open={open}/>}</div></main><SiteFooter/></div>
}
