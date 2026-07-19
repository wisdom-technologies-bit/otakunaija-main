'use client'

import { useState } from 'react'

interface ExpandableSynopsisProps {
  synopsis: string
  maxLength?: number
}

export function ExpandableSynopsis({ synopsis, maxLength = 200 }: ExpandableSynopsisProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = synopsis.length > maxLength
  const displayText = expanded || !isLong ? synopsis : `${synopsis.slice(0, maxLength).trim()}...`

  return (
    <div>
      <h2 className="mb-3 text-base font-bold text-foreground">About this episode</h2>
      <p className="text-sm leading-relaxed text-foreground/80">
        {displayText}
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="ml-2 font-medium text-red-500 hover:underline"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </p>
    </div>
  )
}