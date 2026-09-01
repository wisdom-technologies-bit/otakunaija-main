"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { Save, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { ImageUploader } from "@/components/admin/image-uploader"
import { createCreatorAction, updateCreatorAction } from "@/app/actions/admin"
import type { creators as Creator } from "@/lib/db/schema"

type State = { ok: boolean; error?: string | null; savedAt?: number } | null

type Props = {
  mode: "create" | "edit"
  creator?: typeof Creator.$inferSelect
  justCreated?: boolean
}

export function CreatorEditor({ mode, creator, justCreated }: Props) {
  const action = mode === "create" ? createCreatorAction : updateCreatorAction
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const result = await action(_prev, formData)
      return result ?? null
    },
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      toast.success("Creator saved")
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  useEffect(() => {
    if (justCreated) toast.success("Creator created")
  }, [justCreated])

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && creator ? <input type="hidden" name="id" value={creator.id} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">
            {mode === "create" ? "New Creator" : "Edit Creator"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/creators"
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
          <Field label="Name" htmlFor="name">
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={creator?.name}
              placeholder="e.g., Chuma Studios"
              className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <Field label="Slug" htmlFor="slug" hint="Auto-generated from name if empty.">
            <input
              id="slug"
              name="slug"
              type="text"
              defaultValue={creator?.slug}
              placeholder="auto-generated"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <Field label="Bio" htmlFor="bio">
            <textarea
              id="bio"
              name="bio"
              rows={4}
              defaultValue={creator?.bio || ""}
              placeholder="Tell us about this creator..."
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <Field label="Facebook URL" htmlFor="facebook_url">
            <input
              id="facebook_url"
              name="facebook_url"
              type="url"
              defaultValue={creator?.facebookUrl || ""}
              placeholder="https://facebook.com/..."
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
        </div>

        <div>
          <div className="rounded-xl border border-border bg-card p-4">
            <ImageUploader name="avatar_url" defaultValue={creator?.avatarUrl ?? ""} label="Avatar" />
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
