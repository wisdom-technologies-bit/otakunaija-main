'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

type EpisodesSearchBarProps = { autoFocus?: boolean; defaultValue?: string; compact?: boolean }
type Suggestion = { id: number; title: string; imageUrl?: string | null; slug: string; episodeNumber?: number; seriesTitle?: string | null; seriesSlug?: string | null }
type SuggestionResponse = { series: Suggestion[]; episodes: Suggestion[] }

export function EpisodesSearchBar({ autoFocus, defaultValue, compact }: EpisodesSearchBarProps) {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(defaultValue ?? '')
  const [results, setResults] = useState<SuggestionResponse>({ series: [], episodes: [] })
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const flatResults = [...results.series.map((item) => ({ ...item, type: 'series' as const })), ...results.episodes.map((item) => ({ ...item, type: 'episode' as const }))]

  useEffect(() => {
    const query = value.trim()
    if (query.length < 2) { setResults({ series: [], episodes: [] }); setOpen(false); return }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/episodes/search-suggestions?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Suggestion request failed')
        setResults(await response.json())
        setOpen(true)
        setActive(-1)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setResults({ series: [], episodes: [] })
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [value])

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', closeOnOutside)
    return () => document.removeEventListener('mousedown', closeOnOutside)
  }, [])

  function submit(query = value) {
    const trimmed = query.trim()
    if (trimmed) { setOpen(false); router.push(`/episodes/search?q=${encodeURIComponent(trimmed)}`) }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'ArrowDown' && open) { event.preventDefault(); setActive((current) => Math.min(current + 1, flatResults.length - 1)) }
    else if (event.key === 'ArrowUp' && open) { event.preventDefault(); setActive((current) => Math.max(current - 1, -1)) }
    else if (event.key === 'Escape') setOpen(false)
    else if (event.key === 'Enter') { event.preventDefault(); const selected = flatResults[active]; selected ? submit(selected.type === 'series' ? selected.title : selected.seriesTitle ?? selected.title) : submit() }
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <form onSubmit={(event) => { event.preventDefault(); submit() }} className="flex w-full items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={value} onChange={(event) => setValue(event.target.value)} onFocus={() => value.trim().length >= 2 && setOpen(true)} onKeyDown={handleKeyDown} placeholder="Search episode titles, series..." className={compact ? 'h-9 rounded-full bg-background/70 pl-9 pr-9 text-sm [&::-webkit-search-cancel-button]:appearance-none' : 'h-11 bg-card pl-10 pr-10 [&::-webkit-search-cancel-button]:appearance-none'} autoFocus={autoFocus} aria-label="Search episodes" role="combobox" aria-expanded={open} aria-controls="episode-search-suggestions" aria-autocomplete="list" />
          {value && <button type="button" onClick={() => { setValue(''); setOpen(false) }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X /></button>}
        </div>
        <Button type="submit" className={compact ? 'sr-only' : 'h-11 bg-primary text-primary-foreground hover:bg-primary/90'}>Search</Button>
      </form>
      {open && <div id="episode-search-suggestions" role="listbox" aria-label="Search suggestions" className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover p-2 shadow-xl">
        {loading ? <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Searching...</div> : flatResults.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">No matches found. Try another title.</p> : <>
          {flatResults.map((item, index) => { const href = item.type === 'series' ? `/episodes/${item.slug}` : `/episodes/${item.seriesSlug}/${item.slug}`; return <button key={`${item.type}-${item.id}`} type="button" role="option" aria-selected={active === index} onMouseDown={(event) => event.preventDefault()} onClick={() => router.push(href)} className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${active === index ? 'bg-primary/10' : 'hover:bg-muted'}`}>
            <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">{item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="40px" className="object-cover" /> : <div className="flex size-full items-center justify-center text-muted-foreground"><Search /></div>}</div>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.type === 'series' ? 'Series' : `${item.seriesTitle} · Episode ${item.episodeNumber}`}</span></span>
            {active === index && <Check className="text-primary" aria-hidden="true" />}
          </button> })}
          <button type="button" onClick={() => submit()} className="mt-1 w-full border-t border-border px-3 pt-2 text-left text-xs font-semibold text-primary">View all results for “{value.trim()}”</button>
        </>}
      </div>}
    </div>
  )
}
