'use client'

import { useState } from 'react'
import { BarChart3, Check, Clock3, Globe2, Monitor, Smartphone, Tablet, TrendingUp, Users, Eye, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { PollCard } from '@/components/poll-card'

type Poll = { id:number; slug:string; title:string; description:string|null; status:string; startsAt:Date|string|null; endsAt:Date|string|null; allowMultipleVotes:boolean; totalVotes:number; options:Array<{id:number;label:string;description:string|null;imageUrl:string|null}> }
type Analytics = { votes:number; views:number; resultViews:number; optionCounts:Array<{optionId:number;count:number}>; countries:Array<{name:string;code:string|null;count:number}>; countryOptions:Array<{country:string;optionId:number;count:number}>; devices:Array<{device:string;count:number}>; sources:Array<{source:string;count:number}>; timeline:Array<{bucket:string;count:number}> }

const chartConfig = { count: { label: 'Responses', color: 'var(--chart-1)' }, views: { label: 'Views', color: 'var(--chart-2)' } }
const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
const percent = (value:number,total:number) => total ? `${((value/total)*100).toFixed(1)}%` : '0%'
const formatDate = (value:Date|string|null) => value ? new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : null

export function PollDetailClient({ poll, analytics, open }: { poll:Poll; analytics:Analytics; open:boolean }) {
  const [showResults, setShowResults] = useState(!open)
  const [recorded, setRecorded] = useState(!open)
  const totalSelections = analytics.optionCounts.reduce((sum,row)=>sum+row.count,0)
  const counts = new Map(analytics.optionCounts.map(row => [row.optionId, row.count]))
  const ranking = poll.options.map(option => ({ ...option, count: counts.get(option.id) || 0 })).sort((a,b) => b.count - a.count)
  const reveal = async () => {
    setShowResults(true)
    if (!recorded) {
      setRecorded(true)
      await fetch('/api/polls/result-view',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pollId:poll.id})}).catch(()=>undefined)
    }
  }
  const winner = ranking[0]
  const runner = ranking[1]
  const enoughCountries = analytics.countries.filter(country=>country.count>=5)
  const insights = [
    winner?.count && analytics.votes >= 10 ? `${winner.label} leads with ${percent(winner.count,totalSelections)} of all selections.` : null,
    enoughCountries[0] ? `${enoughCountries[0].name} is the community's most active location.` : null,
    winner?.count && runner?.count && analytics.votes >= 20 ? `${winner.label} leads ${runner.label} by ${winner.count-runner.count} selections.` : null,
  ].filter(Boolean) as string[]

  return <div className="flex flex-col gap-8">
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 md:p-8">
      <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">
        <div className="mb-4 flex flex-wrap items-center gap-2"><Badge variant={open?'default':'secondary'}>{open?'Live poll':'Voting ended'}</Badge>{poll.allowMultipleVotes?<Badge variant="outline">Multiple choice</Badge>:null}<Badge variant="outline">{poll.options.length} options</Badge></div>
        <h1 className="max-w-4xl font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">{poll.title}</h1>
        {poll.description?<p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">{poll.description}</p>:null}
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">{poll.startsAt?<span>Started {formatDate(poll.startsAt)}</span>:null}{poll.endsAt?<span className="inline-flex items-center gap-1"><Clock3 className="size-4"/>Ends {formatDate(poll.endsAt)}</span>:null}<span className="inline-flex items-center gap-1"><Users className="size-4"/>{analytics.votes.toLocaleString()} respondents</span></div>
        {open ? <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Have your say</p><p className="mt-1 text-sm text-muted-foreground">Vote below, then reveal the community&apos;s current verdict.</p></div><Button onClick={() => document.getElementById('vote-now')?.scrollIntoView({behavior:'smooth'})}>Vote now</Button></div> : null}
      </div>
    </section>

    {open ? <section id="vote-now" className="scroll-mt-6"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Cast your vote</p><h2 className="font-display text-2xl font-bold">What do you think?</h2></div><Share2 className="size-5 text-muted-foreground" aria-hidden="true" /></div><PollCard poll={poll} onSubmitted={reveal}/>{!showResults?<div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-border p-5 text-center"><p className="text-sm text-muted-foreground">Results are hidden until you choose to view them.</p><Button className="mt-3" variant="outline" onClick={reveal}>View results</Button></div>:null}</section> : null}
    {showResults ? <Results poll={poll} analytics={analytics} ranking={ranking} totalSelections={totalSelections} enoughCountries={enoughCountries} insights={insights}/> : null}
  </div>
}

function Results({poll,analytics,ranking,totalSelections,enoughCountries,insights}:{poll:Poll;analytics:Analytics;ranking:Array<Poll['options'][number]&{count:number}>;totalSelections:number;enoughCountries:Array<{name:string;code:string|null;count:number}>;insights:string[]}) {
  const winner = ranking[0]
  const deviceIcon = (device:string) => device.toLowerCase().includes('mobile') ? <Smartphone className="size-4 text-primary"/> : device.toLowerCase().includes('tablet') ? <Tablet className="size-4 text-primary"/> : <Monitor className="size-4 text-primary"/>
  return <section id="poll-results" className="flex flex-col gap-6" aria-labelledby="results-heading">
    <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">The community verdict</p><h2 id="results-heading" className="mt-1 font-display text-3xl font-bold">Poll results</h2></div><BarChart3 className="size-7 text-primary" aria-hidden="true"/></div>
    <div className="grid gap-3 sm:grid-cols-3"><Stat icon={<Users/>} label="Respondents" value={analytics.votes.toLocaleString()}/><Stat icon={<Eye/>} label="Poll views" value={analytics.views.toLocaleString()}/><Stat icon={<TrendingUp/>} label="Vote conversion" value={percent(analytics.votes,analytics.views)}/></div>
    <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
      <Card><CardHeader><CardTitle>Ranking</CardTitle><CardDescription>Share of all selections{poll.allowMultipleVotes?' · multiple selections allowed':''}</CardDescription></CardHeader><CardContent>{totalSelections===0?<p className="text-sm text-muted-foreground">No votes yet. Be the first to vote.</p>:<ChartContainer config={chartConfig} className="h-[280px] w-full"><BarChart accessibilityLayer data={ranking}><CartesianGrid vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tickFormatter={(v)=>v.length>16?`${v.slice(0,16)}…`:v}/><YAxis allowDecimals={false} tickLine={false} axisLine={false}/><ChartTooltip content={<ChartTooltipContent/>}/><Bar dataKey="count" radius={6} fill="var(--color-count)">{ranking.map((option,index)=><Cell key={option.id} fill={colors[index%colors.length]}/>)}</Bar></BarChart></ChartContainer>}{winner?<p className="mt-4 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{winner.label}</span> is currently leading with {percent(winner.count,totalSelections)}.</p>:null}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="size-5 text-primary"/>Geography</CardTitle><CardDescription>Aggregated locations only</CardDescription></CardHeader><CardContent>{enoughCountries.length?<div className="flex flex-col gap-3">{enoughCountries.slice(0,7).map(country=><div key={country.name} className="flex items-center justify-between gap-3 text-sm"><span>{country.name}</span><span className="font-medium text-muted-foreground">{country.count} · {percent(country.count,analytics.votes)}</span></div>)}</div>:<p className="text-sm text-muted-foreground">Not enough geographic data yet.</p>}</CardContent></Card>
    </div>
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="size-5 text-primary"/>Response activity</CardTitle><CardDescription>Selections over time</CardDescription></CardHeader><CardContent>{analytics.timeline.length?<ChartContainer config={chartConfig} className="h-[240px] w-full"><BarChart accessibilityLayer data={analytics.timeline}><CartesianGrid vertical={false}/><XAxis dataKey="bucket" tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tickLine={false} axisLine={false}/><ChartTooltip content={<ChartTooltipContent/>}/><Bar dataKey="count" fill="var(--color-count)" radius={4}/></BarChart></ChartContainer>:<p className="text-sm text-muted-foreground">No timeline data yet.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Monitor className="size-5 text-primary"/>Devices</CardTitle><CardDescription>How respondents joined</CardDescription></CardHeader><CardContent>{analytics.devices.length?<div className="flex flex-col gap-3">{analytics.devices.map(row=><div key={row.device} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2">{deviceIcon(row.device)}{row.device}</span><span className="font-medium text-muted-foreground">{row.count} selections · {percent(row.count,totalSelections)}</span></div>)}</div>:<p className="text-sm text-muted-foreground">No device data yet.</p>}</CardContent></Card></div>
    <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><Card><CardHeader><CardTitle>Traffic sources</CardTitle><CardDescription>Where poll visits came from</CardDescription></CardHeader><CardContent>{analytics.sources.length?<ChartContainer config={chartConfig} className="h-[230px] w-full"><PieChart><ChartTooltip content={<ChartTooltipContent/>}/><Pie data={analytics.sources} dataKey="count" nameKey="source" innerRadius={55} outerRadius={85} paddingAngle={3}>{analytics.sources.map((row,index)=><Cell key={row.source} fill={colors[index%colors.length]}/>)}</Pie></PieChart></ChartContainer>:<p className="text-sm text-muted-foreground">No source data yet.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Check className="size-5 text-primary"/>What stands out</CardTitle><CardDescription>Insights appear as enough responses accumulate</CardDescription></CardHeader><CardContent>{insights.length?<ul className="flex flex-col gap-4 text-sm">{insights.map(insight=><li key={insight} className="border-l-2 border-primary pl-3 leading-6">{insight}</li>)}</ul>:<p className="text-sm text-muted-foreground">More votes are needed before reliable insights can be shown.</p>}</CardContent></Card></div>
  </section>
}
function Stat({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <Card><CardContent className="flex items-center gap-3 p-4"><span className="text-primary">{icon}</span><div><div className="text-xl font-bold">{value}</div><div className="text-sm text-muted-foreground">{label}</div></div></CardContent></Card>}
