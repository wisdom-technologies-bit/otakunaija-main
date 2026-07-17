"use client"

import Link from "next/link"
import { useActionState, useEffect, useState } from "react"
import { Save, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { VideoUploader } from "@/components/admin/video-uploader"
import { createEpisodeAction, updateEpisodeAction } from "@/app/actions/admin"
import type { episodes as Episode, series as Series } from "@/lib/db/schema"

type State = { ok: boolean; error?: string | null; savedAt?: number } | null

type Props = {
  mode: "create" | "edit"
  episode?: typeof Episode.$inferSelect
  series: (typeof Series.$inferSelect)[]
  justCreated?: boolean
}

export function EpisodeEditor({ mode, episode, series, justCreated }: Props) {
  const action = mode === "create" ? createEpisodeAction : updateEpisodeAction
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const result = await action(_prev, formData)
      return result ?? null
    },
    null,
  )

  const [videoData, setVideoData] = useState<{
    video_url: string
    thumbnail_url: string
    duration: number
    public_id: string
  } | null>(null)

  useEffect(() => {
    if (state?.ok) {
      toast.success("Episode saved")
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  useEffect(() => {
    if (justCreated) toast.success("Episode created")
  }, [justCreated])

  if (series.length === 0) {
    return (
      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950">
        <p className="text-sm text-orange-900 dark:text-orange-100">
          No series yet. You must create a series before adding episodes.{" "}
          <Link href="/admin/series/new" className="font-medium underline hover:no-underline">
            Add your first series
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && episode ? <input type="hidden" name="id" value={episode.id} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">
            {mode === "create" ? "New Episode" : "Edit Episode"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/episodes"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-card"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {pending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {state?.error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      ) : null}
      {state?.ok ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-500">
          <CheckCircle2 className="h-4 w-4" /> Saved
        </div>
      ) : null}

      <div className="space-y-4">
        <Field label="Series" htmlFor="series_id">
          <select
            id="series_id"
            name="series_id"
            required
            defaultValue={episode?.seriesId || ""}
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a series...</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Episode Number" htmlFor="episode_number">
            <input
              id="episode_number"
              name="episode_number"
              type="number"
              min={1}
              required
              defaultValue={episode?.episodeNumber}
              placeholder="1"
              className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <Field label="Title" htmlFor="title">
            <input
              id="title"
              name="title"
              type="text"
              required
              defaultValue={episode?.title}
              placeholder="e.g., The Awakening"
              className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
        </div>

        <Field label="Slug" htmlFor="slug" hint="Auto-generated from title if empty.">
          <input
            id="slug"
            name="slug"
            type="text"
            defaultValue={episode?.slug}
            placeholder="auto-generated"
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field label="Synopsis" htmlFor="synopsis">
          <textarea
            id="synopsis"
            name="synopsis"
            rows={4}
            defaultValue={episode?.synopsis || ""}
            placeholder="Describe this episode..."
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        {/* Video uploader with direct Cloudinary upload */}
        <div className="rounded-xl border border-border bg-card p-4">
          <VideoUploader
            name="video_url"
            thumbnailName="thumbnail_url"
            durationName="duration_seconds"
            videoPublicIdName="video_public_id"
            defaultVideoUrl={episode?.video_url}
            defaultThumbnailUrl={episode?.thumbnail_url}
            onUploadComplete={setVideoData}
          />
        </div>
      </div>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
