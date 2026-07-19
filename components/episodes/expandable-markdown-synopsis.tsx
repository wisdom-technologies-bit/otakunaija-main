'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ExpandableMarkdownSynopsisProps {
  synopsis: string
  maxLength?: number
  className?: string
}

export function ExpandableMarkdownSynopsis({
  synopsis,
  maxLength = 200,
  className = '',
}: ExpandableMarkdownSynopsisProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = synopsis.length > maxLength
  const displayText = expanded || !isLong ? synopsis : `${synopsis.slice(0, maxLength).trim()}...`

  return (
    <div className={className}>
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-sm font-medium text-red-500 hover:underline"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}