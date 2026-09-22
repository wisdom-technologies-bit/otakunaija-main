'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type EpisodesSearchBarProps = {
  autoFocus?: boolean
  defaultValue?: string
  compact?: boolean
}

export function EpisodesSearchBar({ autoFocus, defaultValue, compact }: EpisodesSearchBarProps) {
  const router = useRouter()
  const [value, setValue] = useState(defaultValue ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = value.trim()
    if (!q) return
    router.push(`/episodes/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search episode titles, synopses, series..."
          className={`${compact ? "h-9 rounded-full bg-background/70 pl-9 text-sm" : "h-11 bg-card pl-10"} border-border` }
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          aria-label="Search episodes"
        />
      </div>
      <Button type="submit" className={compact ? "sr-only" : "h-11 bg-primary text-primary-foreground hover:bg-primary/90"}>
        Search
      </Button>
    </form>
  )
}
