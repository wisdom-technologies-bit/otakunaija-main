"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { Save, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { ImageUploader } from "@/components/admin/image-uploader"
import { createSeriesAction, updateSeriesAction } from "@/app/actions/admin"
import type { series as Series, creators as Creator } from "@/lib/db/schema"

type State = { ok: boolean; error?: string | null; savedAt?: number } | null

const ANIME_GENRES = ["Shonen", "Shojo", "Seinen", "Josei", "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"]

type Props = {
  mode: "create" | "edit"
  series?: typeof Series.$inferSelect
  creators: (typeof Creator.$inferSelect)[]
  justCreated?: boolean
}

export function SeriesEditor({ mode, series, creators, justCreated }: Props) {
  const action = mode === "create" ? createSeriesAction : updateSeriesAction
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const result = await action(_prev, formData)
      return result ?? null
    },
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      toast.success("Series saved")
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  useEffect(() => {
    if (justCreated) toast.success("Series created")
  }, [justCreated])

  if (creators.length === 0) {
    return (
      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950">
        <p className="text-sm text-orange-900 dark:text-orange-100">
          No creators yet. You must create a creator before adding a series.{" "}
          <Link href="/admin/creators/new" className="font-medium underline hover:no-underline">
            Add your first creator
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && series ? <input type="hidden" name="id" value={series.id} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">
            {mode === "create" ? "New Series" : "Edit Series"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/series"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Field label="Creator" htmlFor="creator_id">
            <select
              id="creator_id"
              name="creator_id"
              required
              defaultValue={series?.creatorId || ""}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a creator...</option>
              {creators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Title" htmlFor="title">
            <input
              id="title"
              name="title"
              type="text"
              required
              defaultValue={series?.title}
              placeholder="e.g., Rise of Akaida"
              className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <Field label="Slug" htmlFor="slug" hint="Auto-generated from title if empty.">
            <input
              id="slug"
              name="slug"
              type="text"
              defaultValue={series?.slug}
              placeholder="auto-generated"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <Field label="Synopsis" htmlFor="synopsis">
            <textarea
              id="synopsis"
              name="synopsis"
              rows={4}
              defaultValue={series?.synopsis || ""}
              placeholder="Describe the series..."
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Genre" htmlFor="genre">
              <select
                id="genre"
                name="genre"
                defaultValue={series?.genre || ""}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select genre...</option>
                {ANIME_GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status" htmlFor="status">
              <select
                id="status"
                name="status"
                defaultValue={series?.status || "ongoing"}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <ImageUploader name="cover_image_url" defaultValue={series?.coverImageUrl ?? ""} label="Cover Image (wide banner, shown at top of series page)" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <ImageUploader name="poster_image_url" defaultValue={series?.posterImageUrl ?? ""} label="Poster Image (portrait, shown next to title)" />
          </div>
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
