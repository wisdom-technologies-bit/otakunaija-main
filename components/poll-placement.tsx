import { getPlacementPoll } from '@/lib/db/queries/polls'
import { PollCard } from '@/components/poll-card'
import { PollImpressionTracker } from '@/components/poll-impression-tracker'

type PollPlacementProps = {
  source: 'homepage' | 'blog' | 'blog_article' | 'episodes' | 'series' | 'episode'
  className?: string
}

export async function PollPlacement({ source, className = '' }: PollPlacementProps) {
  try {
    const poll = await getPlacementPoll()
    if (!poll || poll.options.length === 0) return null

    return <section className={className} aria-labelledby={`${source}-poll-heading`}>
      <PollImpressionTracker pollIds={[poll.id]} source={source} />
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Community poll</p>
        <h2 id={`${source}-poll-heading`} className="mt-1 font-display text-xl font-bold">Have your say</h2>
      </div>
      <PollCard poll={poll} compact />
    </section>
  } catch (error) {
    console.error('[v0] poll placement failed', { source, error })
    return null
  }
}
