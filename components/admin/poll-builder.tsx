'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createPoll, updatePoll } from '@/app/actions/polls'

type PollStatus = 'DRAFT' | 'ACTIVE' | 'ENDED'
type PollOption = { id?: number; label: string; description: string; imageUrl: string; imagePublicId: string; isActive: boolean }
type Initial = { id?: number; title: string; slug: string; description?: string | null; status: PollStatus; featured: boolean; allowMultipleVotes: boolean; startsAt?: Date | null; endsAt?: Date | null; options: Array<{ id?: number; label: string; description?: string | null; imageUrl?: string | null; imagePublicId?: string | null; isActive?: boolean }> }

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 220) }
function dateInput(value?: Date | null) { return value ? new Date(value).toISOString().slice(0, 16) : '' }

export function PollBuilder({ initial }: { initial?: Initial }) {
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title || '')
  const [slug, setSlug] = useState(initial?.slug || '')
  const [slugEdited, setSlugEdited] = useState(Boolean(initial?.slug))
  const [description, setDescription] = useState(initial?.description || '')
  const [status, setStatus] = useState<PollStatus>(initial?.status || 'DRAFT')
  const [featured, setFeatured] = useState(initial?.featured || false)
  const [multiple, setMultiple] = useState(initial?.allowMultipleVotes || false)
  const [startsAt, setStartsAt] = useState(dateInput(initial?.startsAt))
  const [endsAt, setEndsAt] = useState(dateInput(initial?.endsAt))
  const [options, setOptions] = useState<PollOption[]>(initial?.options.map((option) => ({ id: option.id, label: option.label, description: option.description || '', imageUrl: option.imageUrl || '', imagePublicId: option.imagePublicId || '', isActive: option.isActive ?? true })) || [{ label: '', description: '', imageUrl: '', imagePublicId: '', isActive: true }, { label: '', description: '', imageUrl: '', imagePublicId: '', isActive: true }])
  const [pending, setPending] = useState(false)
  const [uploading, setUploading] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { if (!slugEdited) setSlug(slugify(title)) }, [title, slugEdited])
  const activeOptions = useMemo(() => options.filter((option) => option.isActive && option.label.trim()), [options])

  function updateOption(index: number, patch: Partial<PollOption>) { setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option)) }
  function moveOption(index: number, direction: -1 | 1) { const next = index + direction; if (next < 0 || next >= options.length) return; setOptions((current) => { const copy = [...current]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy }) }
  function addOption() { if (options.length < 20) setOptions((current) => [...current, { label: '', description: '', imageUrl: '', imagePublicId: '', isActive: true }]) }
  function removeOption(index: number) { if (options.length > 2) setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index)) }

  async function uploadOptionImage(index: number, file: File) {
    setUploading(index); setError('')
    try {
      const form = new FormData(); form.append('file', file)
      const response = await fetch('/api/admin/upload', { method: 'POST', body: form })
      const result = await response.json() as { url?: string; publicId?: string; error?: string }
      if (!response.ok || !result.url || !result.publicId) throw new Error(result.error || 'Image upload failed')
      updateOption(index, { imageUrl: result.url, imagePublicId: result.publicId })
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed') } finally { setUploading(null) }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(''); setSuccess('')
    try {
      if (uploading !== null) throw new Error('Wait for the image upload to finish')
      if (activeOptions.length < 2) throw new Error('Add at least two active options')
      const input = { title, slug, description, status, featured, allowMultipleVotes: multiple, startsAt: startsAt || null, endsAt: endsAt || null, options: options.map((option) => ({ ...option, displayOrder: 0 })) }
      const result = initial?.id ? await updatePoll(initial.id, input) : await createPoll(input)
      setSuccess(initial?.id ? 'Poll updated successfully.' : 'Poll created successfully.')
      const destination = initial?.id ? `/admin/polls/${initial.id}` : `/admin/polls/${'id' in result ? result.id : ''}`
      router.push(destination); router.refresh()
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Unable to save poll') } finally { setPending(false) }
  }

  return <form onSubmit={submit} className="flex flex-col gap-6">
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-5"><h2 className="font-display text-lg font-bold">Poll information</h2><p className="text-sm text-muted-foreground">Give the community a clear question and a shareable URL.</p></div><div className="grid gap-5"><div className="grid gap-2"><Label htmlFor="title">Poll title</Label><Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required /></div><div className="grid gap-2"><Label htmlFor="slug">Slug</Label><Input id="slug" value={slug} onChange={(event) => { setSlugEdited(true); setSlug(slugify(event.target.value)) }} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><p className="text-xs text-muted-foreground">Public URL: /polls/{slug || 'your-poll-slug'}</p></div><div className="grid gap-2"><Label htmlFor="description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={4} /></div></div></section>
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-5"><h2 className="font-display text-lg font-bold">Publishing and schedule</h2><p className="text-sm text-muted-foreground">Times use your browser&apos;s local timezone and are stored consistently by the server.</p></div><div className="grid gap-5 md:grid-cols-3"><div className="grid gap-2"><Label htmlFor="status">Status</Label><select id="status" value={status} onChange={(event) => setStatus(event.target.value as PollStatus)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="ENDED">Ended</option></select></div><div className="grid gap-2"><Label htmlFor="startsAt">Starts at</Label><Input id="startsAt" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="endsAt">Ends at</Label><Input id="endsAt" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></div></div><div className="mt-5 flex flex-wrap gap-5"><label className="flex items-center gap-3 text-sm"><Switch checked={featured} onCheckedChange={setFeatured} /><span><strong>Featured poll</strong><span className="block text-xs text-muted-foreground">Highlight it in discovery.</span></span></label><label className="flex items-center gap-3 text-sm"><Switch checked={multiple} onCheckedChange={setMultiple} /><span><strong>Allow multiple selections</strong><span className="block text-xs text-muted-foreground">Voters can choose more than one option in one submission.</span></span></label></div></section>
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-lg font-bold">Poll options</h2><p className="text-sm text-muted-foreground">At least two active options are required to publish.</p></div><Button type="button" variant="outline" onClick={addOption} disabled={options.length >= 20}><Plus className="size-4" /> Add option</Button></div><div className="flex flex-col gap-4">{options.map((option, index) => <div key={option.id ?? index} className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-[auto_1fr_180px]"><div className="flex items-start gap-1 md:flex-col"><Button type="button" variant="ghost" size="icon" aria-label={`Move option ${index + 1} up`} onClick={() => moveOption(index, -1)} disabled={index === 0}><ArrowUp className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Move option ${index + 1} down`} onClick={() => moveOption(index, 1)} disabled={index === options.length - 1}><ArrowDown className="size-4" /></Button></div><div className="grid gap-3"><div className="grid gap-2"><Label htmlFor={`option-label-${index}`}>Option {index + 1} label</Label><Input id={`option-label-${index}`} value={option.label} onChange={(event) => updateOption(index, { label: event.target.value })} required /></div><div className="grid gap-2"><Label htmlFor={`option-description-${index}`}>Description</Label><Textarea id={`option-description-${index}`} value={option.description} onChange={(event) => updateOption(index, { description: event.target.value })} rows={2} /></div><label className="flex items-center gap-2 text-sm"><Switch checked={option.isActive} onCheckedChange={(checked) => updateOption(index, { isActive: checked })} /> Active option</label></div><div className="flex flex-col gap-3"><div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted">{option.imageUrl ? <><img src={option.imageUrl} alt={`${option.label || 'Option'} preview`} className="h-full w-full object-cover" /><button type="button" aria-label={`Remove image for option ${index + 1}`} onClick={() => updateOption(index, { imageUrl: '', imagePublicId: '' })} className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-foreground shadow"><X className="size-4" /></button></> : <ImagePlus className="size-8 text-muted-foreground" />}</div><label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted"><ImagePlus className="size-4" />{uploading === index ? 'Uploading…' : option.imageUrl ? 'Replace image' : 'Upload image'}<input type="file" accept="image/*" className="sr-only" disabled={uploading !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadOptionImage(index, file); event.currentTarget.value = '' }} /></label><Button type="button" variant="ghost" className="text-destructive" onClick={() => removeOption(index)} disabled={options.length <= 2}><Trash2 className="size-4" /> Remove</Button></div></div>)}</div></section>
    {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p> : null}{success ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700" role="status">{success}</p> : null}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => router.push('/admin/polls')}>Cancel</Button><Button type="submit" disabled={pending || uploading !== null}>{pending ? 'Saving…' : initial?.id ? 'Save changes' : 'Create poll'}</Button></div>
  </form>
}
