'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Check, Clock3, Vote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Poll = { id: number; title: string; slug: string; description: string | null; status: string; endsAt: Date | string | null; allowMultipleVotes: boolean; options: Array<{ id: number; label: string; description?: string | null; imageUrl?: string | null }> ; totalVotes?: number }

export function PollCard({ poll, compact = false }: { poll: Poll; compact?: boolean }) {
  const [selected, setSelected] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)
  const ended = poll.status === 'ENDED' || (poll.endsAt && new Date(poll.endsAt) <= new Date())

  async function submitVote() {
    if (!selected.length) return
    setIsPending(true); setError('')
    try {
      const response = await fetch('/api/polls/vote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pollId: poll.id, optionIds: selected }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to vote')
      setSubmitted(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to vote') } finally { setIsPending(false) }
  }

  function toggleOption(id: number) {
    setSelected((current) => poll.allowMultipleVotes ? current.includes(id) ? current.filter((value) => value !== id) : [...current, id] : [id])
  }

  return <article className={`rounded-xl border border-border bg-card p-5 ${compact ? '' : 'md:p-6'}`}>
    <div className="flex items-start justify-between gap-3">
      <div><div className="mb-2 flex items-center gap-2"><Badge variant={ended ? 'secondary' : 'default'}>{ended ? 'Ended' : 'Active'}</Badge>{poll.allowMultipleVotes ? <Badge variant="outline">Multiple choice</Badge> : null}</div><h3 className="font-display text-lg font-bold leading-tight">{poll.title}</h3>{poll.description ? <p className="mt-2 text-sm text-muted-foreground">{poll.description}</p> : null}</div>
      <Vote className="size-5 shrink-0 text-primary" aria-hidden="true" />
    </div>
    <div className="mt-5 flex flex-col gap-2">
      {poll.options.slice(0, compact ? 4 : 20).map((option) => <button key={option.id} type="button" onClick={() => !ended && !submitted && toggleOption(option.id)} disabled={!!ended || submitted} aria-pressed={selected.includes(option.id)} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors ${selected.includes(option.id) ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background/40 hover:border-primary/60'} disabled:cursor-default`}>
        <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${selected.includes(option.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50'}`}>{selected.includes(option.id) ? <Check className="size-3" /> : null}</span>
        {option.imageUrl ? <img src={option.imageUrl} alt="" className="size-10 rounded-md object-cover" /> : null}<span className="font-medium">{option.label}</span>
      </button>)}
    </div>
    {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
    {submitted ? <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-primary/10 px-3 py-3 text-sm"><span className="font-medium text-primary">Vote submitted</span><Button asChild size="sm" variant="outline"><Link href={`/polls/${poll.slug}`}>View results <ArrowRight data-icon="inline-end" /></Link></Button></div> : <Button className="mt-4 w-full" onClick={submitVote} disabled={!!ended || !selected.length || isPending}>{isPending ? 'Submitting…' : ended ? 'Voting closed' : 'Vote'} </Button>}
    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{poll.totalVotes || 0} votes</span>{poll.endsAt && !ended ? <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> Ends {new Date(poll.endsAt).toLocaleDateString()}</span> : null}</div>
  </article>
}

export function PollResults({ options, votes }: { options: Array<{ id: number; label: string }>; votes: Array<{ optionId: number }> }) {
  const total = votes.length
  const counts = new Map<number, number>()
  votes.forEach((vote) => counts.set(vote.optionId, (counts.get(vote.optionId) || 0) + 1))
  return <div className="flex flex-col gap-4">{options.map((option) => { const count = counts.get(option.id) || 0; const percentage = total ? (count / total) * 100 : 0; return <div key={option.id}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="font-medium">{option.label}</span><span className="text-muted-foreground">{percentage.toFixed(1)}% · {count}</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} /></div></div> })}</div>
}
