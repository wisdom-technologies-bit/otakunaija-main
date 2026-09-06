'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Check, Clock3, Vote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Poll = { id: number; title: string; slug: string; description: string | null; status: string; startsAt?: Date | string | null; endsAt: Date | string | null; allowMultipleVotes: boolean; featured?: boolean; options: Array<{ id: number; label?: string | null; description?: string | null; imageUrl?: string | null }> ; totalVotes?: number }

export function PollCard({ poll, compact = false, onSubmitted }: { poll: Poll; compact?: boolean; onSubmitted?: () => void }) {
  const [selected, setSelected] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const now = new Date()
  const ended = poll.status === 'ENDED' || (poll.endsAt && new Date(poll.endsAt) <= now)
  const upcoming = !ended && poll.startsAt && new Date(poll.startsAt) > now
  const visibleOptions = expanded || poll.options.length <= 5 ? poll.options : poll.options.slice(0, 5)
  const imageFocused = poll.options.length > 0 && poll.options.every((option) => option.imageUrl && !option.label?.trim())
  const optionAccessibleName = (option: Poll['options'][number]) => option.label?.trim() || option.description?.trim() || `Image option for ${poll.title}`

  async function submitVote() {
    if (!selected.length) return
    setIsPending(true); setError('')
    try {
      const response = await fetch('/api/polls/vote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pollId: poll.id, optionIds: selected }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to vote')
      setSubmitted(true)
      onSubmitted?.()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to vote') } finally { setIsPending(false) }
  }

  function toggleOption(id: number) {
    setSelected((current) => poll.allowMultipleVotes ? current.includes(id) ? current.filter((value) => value !== id) : [...current, id] : [id])
  }

  return <article className={`rounded-xl border border-border bg-card p-5 ${compact ? '' : 'md:p-6'}`}>
    <div className="flex items-start justify-between gap-3">
      <div><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant={ended ? 'secondary' : upcoming ? 'outline' : 'default'}>{ended ? 'Ended' : upcoming ? 'Upcoming' : 'Active'}</Badge>{poll.featured ? <Badge variant="outline">Featured</Badge> : null}{poll.allowMultipleVotes ? <Badge variant="outline">Multiple choice</Badge> : null}</div><h3 className="font-display text-lg font-bold leading-tight"><Link href={`/polls/${poll.slug}`} className="hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{poll.title}</Link></h3>{poll.description ? <p className="mt-2 text-sm text-muted-foreground">{poll.description}</p> : null}</div>
      <Vote className="size-5 shrink-0 text-primary" aria-hidden="true" />
    </div>
    <div className={`mt-5 gap-2 ${imageFocused ? 'grid grid-cols-2 sm:grid-cols-3' : 'flex flex-col'}`}>
      {visibleOptions.map((option) => {
        const name = optionAccessibleName(option)
        return <button key={option.id} type="button" onClick={() => !ended && !upcoming && !submitted && toggleOption(option.id)} disabled={!!ended || !!upcoming || submitted} aria-label={name} aria-pressed={selected.includes(option.id)} className={`relative flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors ${imageFocused ? 'min-h-32 flex-col justify-end overflow-hidden p-2' : ''} ${selected.includes(option.id) ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/30' : 'border-border bg-background/40 hover:border-primary/60'} disabled:cursor-default`}>
          {option.imageUrl ? <img src={option.imageUrl} alt="" loading="lazy" className={imageFocused ? 'absolute inset-0 size-full object-cover opacity-80' : 'size-10 shrink-0 rounded-md object-cover'} /> : null}
          <span className={`${imageFocused ? 'relative z-10 self-stretch rounded bg-background/80 px-2 py-1 text-center' : 'flex items-center gap-3'}`}>
            {!imageFocused ? <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${selected.includes(option.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50'}`}>{selected.includes(option.id) ? <Check className="size-3" /> : null}</span> : null}
            <span className="min-w-0"><span className="block font-medium">{option.label?.trim() || (imageFocused ? 'Select image' : option.description?.trim() || 'Select option')}</span>{!imageFocused && option.description?.trim() && option.label?.trim() ? <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span> : null}</span>
          </span>
        </button>
      })}
    </div>
    {poll.options.length > 5 ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="mt-3 text-sm font-medium text-primary hover:underline">{expanded ? 'Show fewer options' : `Show all ${poll.options.length} options`}</button> : null}
    {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
    {submitted ? <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-primary/10 px-3 py-3 text-sm"><span className="font-medium text-primary">Vote submitted</span><Button asChild size="sm" variant="outline"><Link href={`/polls/${poll.slug}`}>View results <ArrowRight data-icon="inline-end" /></Link></Button></div> : <Button className="mt-4 w-full" onClick={submitVote} disabled={!!ended || !!upcoming || !selected.length || isPending}>{isPending ? 'Submitting…' : ended ? 'Voting closed' : upcoming ? 'Voting starts soon' : 'Vote'} </Button>}
    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{poll.totalVotes || 0} votes</span>{poll.endsAt && !ended ? <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> Ends {new Date(poll.endsAt).toLocaleDateString()}</span> : null}</div>
  </article>
}

export function PollResults({ options, votes }: { options: Array<{ id: number; label: string }>; votes: Array<{ optionId: number }> }) {
  const total = votes.length
  const counts = new Map<number, number>()
  votes.forEach((vote) => counts.set(vote.optionId, (counts.get(vote.optionId) || 0) + 1))
  return <div className="flex flex-col gap-4">{options.map((option) => { const count = counts.get(option.id) || 0; const percentage = total ? (count / total) * 100 : 0; return <div key={option.id}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="font-medium">{option.label}</span><span className="text-muted-foreground">{percentage.toFixed(1)}% · {count}</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} /></div></div> })}</div>
}
