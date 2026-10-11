"use client"

import Image from "next/image"
import { useState } from "react"

type Match = { id: number; candidateTitle: string; conflictReason: string | null; series: { id: number; title: string; slug: string; coverImageUrl: string | null; posterImageUrl: string | null }; conflictSeries: { id: number; title: string; slug: string; coverImageUrl: string | null; posterImageUrl: string | null } | null }

function Side({ label, item }: { label: string; item: Match["series"] | Match["conflictSeries"] }) {
  if (!item) return null
  const image = item.posterImageUrl || item.coverImageUrl
  return <div className="flex min-w-0 flex-1 gap-3 rounded-lg border border-border p-3">
    {image ? <Image src={image} alt="" width={64} height={88} className="h-20 w-14 rounded object-cover" unoptimized /> : <div className="h-20 w-14 rounded bg-muted" />}
    <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{item.title}</p><p className="truncate text-xs text-muted-foreground">/{item.slug}</p><p className="mt-1 text-xs">Series ID: {item.id}</p></div>
  </div>
}

export function AniListBackfillClient({ initialMatches }: { initialMatches: Match[] }) {
  const [matches, setMatches] = useState(initialMatches)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState("")
  async function run() { setRunning(true); setMessage(""); const res = await fetch("/api/admin/anilist-backfill/run"); const data = await res.json(); setMessage(res.ok ? `Checked ${data.seriesChecked}: ${data.autoApplied} applied, ${data.flaggedForReview} flagged, ${data.skipped} skipped.` : data.error); setRunning(false); if (res.ok) window.location.reload() }
  async function reject(id: number) { const res = await fetch(`/api/admin/anilist-backfill/${id}/reject`, { method: "POST" }); if (res.ok) setMatches((current) => current.filter((match) => match.id !== id)) }
  async function merge(match: Match) { if (!match.conflictSeries) return; const keep = window.prompt(`Keep which series? Enter ${match.series.id} for ${match.series.title}, or ${match.conflictSeries.id} for ${match.conflictSeries.title}.`, String(match.series.id)); const keepId = Number(keep); const discardId = keepId === match.series.id ? match.conflictSeries.id : keepId === match.conflictSeries.id ? match.series.id : 0; if (!discardId) return; const res = await fetch(`/api/admin/anilist-backfill/${match.id}/merge`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ keepSeriesId: keepId, discardSeriesId: discardId }) }); if (res.ok) setMatches((current) => current.filter((item) => item.id !== match.id)); else setMessage((await res.json()).error || "Merge failed") }
  return <div className="flex flex-col gap-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-2xl font-bold md:text-3xl">AniList Backfill</h1><p className="text-sm text-muted-foreground">Review possible series matches before merging.</p></div><button onClick={run} disabled={running} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{running ? "Running…" : "Run Backfill Now"}</button></div>{message && <p className="rounded-md border border-border bg-card p-3 text-sm">{message}</p>}<section className="rounded-xl border border-border bg-card"><div className="divide-y divide-border">{matches.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No pending matches.</p> : matches.map((match) => <div key={match.id} className="flex flex-col gap-4 p-4"><div className="flex flex-col gap-3 md:flex-row"><Side label="Series missing AniList ID" item={match.series} /><Side label={`AniList candidate · ${match.candidateTitle}`} item={match.conflictSeries} /></div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{match.conflictReason}</p><div className="flex gap-2"><button onClick={() => merge(match)} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Merge</button><button onClick={() => reject(match.id)} className="rounded-md border border-border px-3 py-2 text-sm font-semibold">Reject</button></div></div></div>)}</div></section></div>
}
