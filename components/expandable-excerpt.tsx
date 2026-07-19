'use client'

import { useState } from 'react'

interface ExpandableExcerptProps {
  excerpt: string
  maxLength?: number
}

export function ExpandableExcerpt({ excerpt, maxLength = 160 }: ExpandableExcerptProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = excerpt.length > maxLength
  const displayText = expanded || !isLong ? excerpt : `${excerpt.slice(0, maxLength).trim()}...`

  return (
    <p className="mt-4 text-sm text-muted-foreground text-pretty">
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
  )
}