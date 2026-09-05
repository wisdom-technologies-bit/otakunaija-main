'use client'

import { useState } from 'react'
import { BarChart3, Check, Clock3, Globe2, Monitor, Smartphone, Tablet, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PollCard } from '@/components/poll-card'

type Poll = { id:number; slug:string; title:string; description:string|null; status:string; startsAt:Date|string|null; endsAt:Date|string|null; allowMultipleVotes:boolean; totalVotes:number; options:Array<{id:number;label:string;description:string|null;imageUrl:string|null}> }
type Analytics = { votes:number; views:number; resultViews:number; optionCounts:Array<{optionId:number;count:number}>; countries:Array<{name:string;code:string|null;count:number}>; countryOptions:Array<{country:string;optionId:number;count:number}>; devices:Array<{device:string;count:number}>; sources:Array<{source:string;count:number}>; timeline:Array<{bucket:string;count:number}> }

const percent = (value:number,total:number) => total ? `${((value/total)*100).toFixed(1)}%` : '0%'
const formatDate = (value:Date|string|null) => value ? new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : null

export function PollDetailClient({ poll, analytics, open }: { poll:Poll; analytics:Analytics; open:boolean }) {
  const [showResults, setShowResults] = useState(!open)
  const [recorded, setRecorded] = useState(!open)
  const totalSelections = analytics.optionCounts.reduce((sum,row)=>sum+row.count,0)
  const reveal = async () => {
    setShowResults(true)
    if (!recorded) {
      setRecorded(true)
      await fetch('/api/polls/result-view',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pollId:poll.id})}).catch(()=>undefined)
    }
  }
  const winner = analytics.optionCounts[0]
  const winnerOption = winner ? (poll.options.find(option=>option.id===winner.optionId) ?? null) : null
  const runner = analytics.optionCounts[1]
  const runnerOption = runner ? (poll.options.find(option=>option.id===runner.optionId) ?? null) : null
  const countriesWithEnoughData = analytics.countries.filter(country=>country.count>=5)
  const insights = [
    winnerOption && analytics.votes >= 10 ? `${winnerOption.label} leads with ${percent(winner.count,totalSelections)} of selections.` : null,
    analytics.countries[0] && analytics.countries[0].count >= 5 ? `${analytics.countries[0].name} has contributed the most votes.` : null,
    winner && runner && winnerOption && runnerOption && analytics.votes >= 20 ? `${winnerOption.label} leads ${runnerOption.label} by ${winner.count-runner.count} selections.` : null,
  ].filter(Boolean) as string[]

  return <div className="space-y-8">
    <section className="rounded-xl border border-border bg-card p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2"><Badge variant={open?'default':'secondary'}>{open?'Active':'Voting ended'}</Badge>{poll.allowMultipleVotes?<Badge variant="outline">Multiple choice</Badge>:null}</div>
      <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">{poll.title}</h1>
      {poll.description?<p className="mt-4 max-w-3xl text-lg text-muted-foreground">{poll.description}</p>:null}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">{poll.startsAt?<span>Started {formatDate(poll.startsAt)}</span>:null}{poll.endsAt?<span className="inline-flex items-center gap-1"><Clock3 className="size-4"/>Ends {formatDate(poll.endsAt)}</span>:null}<span>{poll.options.length} options</span></div>
      <div className="mt-8"><PollCard poll={poll} onSubmitted={()=>undefined}/></div>
      {open ? <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4"><p className="text-sm text-muted-foreground">Results stay hidden until you choose to view them.</p><Button className="mt-3" variant="outline" onClick={reveal}>View results</Button></div>:null}
    </section>
    {showResults ? <Results poll={poll} analytics={analytics} totalSelections={totalSelections} winnerOption={winnerOption} runnerOption={runnerOption} countriesWithEnoughData={countriesWithEnoughData} insights={insights}/> : null}
  </div>
}

function Results({poll,analytics,totalSelections,winnerOption,runnerOption,countriesWithEnoughData,insights}:{poll:Poll;analytics:Analytics;totalSelections:number;winnerOption:{id:number;label:string;description:string|null;imageUrl:string|null}|null;runnerOption:{id:number;label:string;description:string|null;imageUrl:string|null}|null;countriesWithEnoughData:Array<{name:string;code:string|null;count:number}>;insights:string[]}) {
  const countFor=(id:number)=>analytics.optionCounts.find(row=>row.optionId===id)?.count||0
  return <section id="poll-results" className="space-y-6" aria-labelledby="results-heading">
    <div className="flex items-center gap-2"><BarChart3 className="size-5 text-primary"/><h2 id="results-heading" className="font-display text-2xl font-bold">Poll results</h2></div>
    <div className="grid gap-4 sm:grid-cols-3"><Stat label="Votes" value={analytics.votes.toLocaleString()}/><Stat label="Winner" value={winnerOption?.label||'No votes yet'}/><Stat label="Leading share" value={winnerOption?percent(countFor(winnerOption.id),totalSelections):'—'}/></div>
    <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
      <div className="rounded-xl border border-border bg-card p-5"><h3 className="font-display text-lg font-bold">Ranking</h3>{totalSelections===0?<p className="mt-5 text-sm text-muted-foreground">No votes yet. Be the first to vote.</p>:<div className="mt-5 space-y-4">{poll.options.map((option,index)=>{const count=countFor(option.id);return <div key={option.id}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="font-medium">{index+1}. {option.label}</span><span className="text-muted-foreground">{percent(count,totalSelections)} · {count.toLocaleString()}</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:percent(count,totalSelections)}}/><span className="sr-only">{option.label}: {count} votes, {percent(count,totalSelections)}</span></div></div>})}</div>}{winnerOption&&runnerOption?<p className="mt-5 text-sm text-muted-foreground">{winnerOption.label} leads {runnerOption.label} by {countFor(winnerOption.id)-countFor(runnerOption.id)} selections.</p>:null}</div>
      <div className="rounded-xl border border-border bg-card p-5"><h3 className="flex items-center gap-2 font-display text-lg font-bold"><Globe2 className="size-5 text-primary"/>Geography</h3><p className="mt-1 text-sm text-muted-foreground">Aggregated locations only.</p>{countriesWithEnoughData.length?<div className="mt-4 space-y-3">{countriesWithEnoughData.slice(0,8).map(country=><div key={country.name} className="flex justify-between text-sm"><span>{country.name}</span><span className="text-muted-foreground">{country.count} · {percent(country.count,analytics.votes)}</span></div>)}</div>:<p className="mt-4 text-sm text-muted-foreground">Not enough geographic data yet.</p>}</div>
    </div>
    <div className="grid gap-6 lg:grid-cols-2"><AnalyticsCard title="Engagement" icon={<TrendingUp className="size-5 text-primary"/>}><Metric label="Poll views" value={analytics.views.toLocaleString()}/><Metric label="Vote conversion" value={percent(analytics.votes,analytics.views)}/><Metric label="Result views" value={analytics.resultViews.toLocaleString()}/><Metric label="Result-view rate" value={percent(analytics.resultViews,analytics.views)}/></AnalyticsCard><AnalyticsCard title="Devices" icon={<Monitor className="size-5 text-primary"/>}>{analytics.devices.length?analytics.devices.map(row=><Metric key={row.device} label={row.device} value={`${row.count.toLocaleString()} · ${percent(row.count,analytics.votes)}`}/>):<p className="text-sm text-muted-foreground">No device data yet.</p>}</AnalyticsCard></div>
    <div className="grid gap-6 lg:grid-cols-2"><AnalyticsCard title="Voting timeline" icon={<TrendingUp className="size-5 text-primary"/>}>{analytics.timeline.length?analytics.timeline.map(point=><Metric key={point.bucket} label={point.bucket} value={point.count.toLocaleString()}/>):<p className="text-sm text-muted-foreground">No timeline data yet.</p>}</AnalyticsCard><AnalyticsCard title="Poll insights" icon={<Check className="size-5 text-primary"/>}>{insights.length?<ul className="space-y-3 text-sm">{insights.map(insight=><li key={insight}>{insight}</li>)}</ul>:<p className="text-sm text-muted-foreground">More votes are needed before reliable insights can be shown.</p>}</AnalyticsCard></div>
  </section>
}
function Stat({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-border bg-card p-4"><div className="text-2xl font-bold">{value}</div><div className="text-sm text-muted-foreground">{label}</div></div>}
function Metric({label,value}:{label:string;value:string}){return <div className="flex justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>}
function AnalyticsCard({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode}){return <div className="rounded-xl border border-border bg-card p-5"><h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">{icon}{title}</h3>{children}</div>}
