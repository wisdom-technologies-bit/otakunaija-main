'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PollResults } from '@/components/poll-card'

export function PollResultsReveal({ options, votes }: { options: Array<{ id: number; label: string }>; votes: Array<{ optionId: number }> }) {
  const [visible, setVisible] = useState(false)
  return <div>{visible ? <PollResults options={options} votes={votes} /> : <Button variant="outline" className="w-full" onClick={() => setVisible(true)}>View results</Button>}</div>
}
