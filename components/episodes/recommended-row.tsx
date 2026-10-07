'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getHistory, HISTORY_CHANGED_EVENT } from '@/lib/watch-history'
import SectionTitle from '@/components/episodes/section-title'

type Recommendation = { slug: string; title: string; posterUrl: string | null; genre: string; latestEpisodeNumber: number | null }

export default function RecommendedRow() {
  const [items, setItems] = useState<Recommendation[] | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined
    const load = () => {
      const slugs = [...new Set(getHistory().map((entry) => entry.seriesSlug))]
      if (!slugs.length) { setItems([]); return }
      fetch(`/api/episodes/recommendations?slugs=${encodeURIComponent(slugs.join(','))}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('Recommendation request failed')))
        .then((data: { series?: Recommendation[] }) => setItems(data.series ?? []))
        .catch((error: unknown) => { if ((error as { name?: string }).name !== 'AbortError') setItems([]) })
    }
    load()
    const onChange = () => { window.clearTimeout(timer); timer = window.setTimeout(load, 500) }
    window.addEventListener(HISTORY_CHANGED_EVENT, onChange)
    return () => { window.clearTimeout(timer); controller.abort(); window.removeEventListener(HISTORY_CHANGED_EVENT, onChange) }
  }, [])
  if (!items?.length) return null
  return <section><SectionTitle title="Recommended For You" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{items.map((item) => <Link key={item.slug} href={`/episodes/${item.slug}`} className="min-w-0"><div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted"><Image src={item.posterUrl ?? '/placeholder.svg'} alt={item.title} fill sizes="(min-width: 640px) 25vw, 50vw" className="object-cover" /><span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">{item.genre}</span>{item.latestEpisodeNumber != null && <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">Ep {item.latestEpisodeNumber}</span>}</div><p className="mt-2 line-clamp-2 text-xs font-medium">{item.title}</p></Link>)}</div></section>
}
