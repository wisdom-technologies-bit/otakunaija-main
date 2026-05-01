"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { ExternalLink, Save, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { CATEGORIES, type Post } from "@/lib/posts"
import { ImageUploader } from "@/components/admin/image-uploader"
import { createPostAction, updatePostAction } from "@/app/actions/admin"

type State = { ok: boolean; error?: string | null; savedAt?: number } | null

type Props = {
  mode: "create" | "edit"
  post?: Post
  justCreated?: boolean
}

export function PostEditor({ mode, post, justCreated }: Props) {
  const action = mode === "create" ? createPostAction : updatePostAction
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const result = await action(_prev, formData)
      return result ?? null
    },
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      toast.success("Post saved")
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  useEffect(() => {
    if (justCreated) toast.success("Post created")
  }, [justCreated])

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && post ? <input type="hidden" name="id" value={post.id} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">
            {mode === "create" ? "New Post" : "Edit Post"}
          </h1>
          {post ? (
            <Link
              href={`/blog/${post.slug}`}
              target="_blank"
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-3 w-3" /> /blog/{post.slug}
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/posts"
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
          <Field label="Title" htmlFor="title">
            <input
              id="title"
              name="title"
              type="text"
              required
              defaultValue={post?.title}
              placeholder="The next big anime release..."
              className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <Field label="Excerpt" htmlFor="excerpt" hint="A short summary that appears in cards and search results.">
            <textarea
              id="excerpt"
              name="excerpt"
              required
              rows={3}
              defaultValue={post?.excerpt}
              placeholder="In one or two sentences, what's this post about?"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <Field label="Content" htmlFor="content" hint="Use Markdown-style headings (## Heading) and lists.">
            <textarea
              id="content"
              name="content"
              required
              rows={20}
              defaultValue={post?.content}
              placeholder="Write your article here..."
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <ImageUploader name="cover_image" defaultValue={post?.cover_image ?? ""} />
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <Field label="Category" htmlFor="category">
              <select
                id="category"
                name="category"
                defaultValue={post?.category || CATEGORIES[0]}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Slug" htmlFor="slug" hint={mode === "create" ? "Auto-generated from title if empty." : "Change with care — alters the URL."}>
              <input
                id="slug"
                name="slug"
                type="text"
                defaultValue={post?.slug}
                placeholder="auto-generated"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>

            <Field label="Author" htmlFor="author">
              <input
                id="author"
                name="author"
                type="text"
                defaultValue={post?.author || "OtakuNaija Team"}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>

            <Field label="Read time (minutes)" htmlFor="read_time">
              <input
                id="read_time"
                name="read_time"
                type="number"
                min={1}
                max={60}
                defaultValue={post?.read_time ?? 5}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>

            <Field label="Tags" htmlFor="tags" hint="Comma-separated.">
              <input
                id="tags"
                name="tags"
                type="text"
                defaultValue={(post?.tags ?? []).join(", ")}
                placeholder="anime, review, shonen"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>

            <div className="space-y-2 pt-2 border-t border-border">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked={post?.featured ?? false}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>Featured on homepage</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="trending"
                  defaultChecked={post?.trending ?? false}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>Show in trending</span>
              </label>
            </div>
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
