"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  checkCredentials,
  clearSessionCookie,
  getCurrentSession,
  setSessionCookie,
} from "@/lib/auth"
import {
  createPost,
  deletePost,
  updatePost,
  type CreatePostInput,
  type UpdatePostInput,
} from "@/lib/admin-queries"

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "")
  const password = String(formData.get("password") || "")
  const from = String(formData.get("from") || "/admin")

  const result = checkCredentials(email, password)
  if (!result.ok) {
    return { ok: false as const, error: result.error || "Invalid credentials" }
  }
  await setSessionCookie(email)
  redirect(from || "/admin")
}

export async function logoutAction() {
  await clearSessionCookie()
  redirect("/admin/login")
}

async function requireSession() {
  const session = await getCurrentSession()
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}

function parseTags(raw: unknown): string[] {
  if (typeof raw !== "string") return []
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

function buildInput(formData: FormData): CreatePostInput {
  return {
    title: String(formData.get("title") || "").trim(),
    excerpt: String(formData.get("excerpt") || "").trim(),
    content: String(formData.get("content") || "").trim(),
    category: String(formData.get("category") || "Shonen").trim(),
    cover_image: String(formData.get("cover_image") || "").trim() || null,
    author: String(formData.get("author") || "OtakuNaija Team").trim(),
    tags: parseTags(formData.get("tags")),
    featured: formData.get("featured") === "on",
    trending: formData.get("trending") === "on",
    read_time: Number(formData.get("read_time") || 5) || 5,
    slug: String(formData.get("slug") || "").trim() || undefined,
  }
}

export async function createPostAction(_prev: unknown, formData: FormData) {
  await requireSession()
  const input = buildInput(formData)
  if (!input.title || !input.excerpt || !input.content || !input.category) {
    return { ok: false as const, error: "Title, excerpt, content, and category are required" }
  }
  const post = await createPost(input)
  revalidatePath("/")
  revalidatePath("/blog")
  revalidatePath("/admin")
  revalidatePath("/admin/posts")
  redirect(`/admin/posts/${post.id}/edit?created=1`)
}

export async function updatePostAction(_prev: unknown, formData: FormData) {
  await requireSession()
  const id = Number(formData.get("id") || 0)
  if (!id) return { ok: false as const, error: "Missing post id" }
  const base = buildInput(formData)
  const input: UpdatePostInput = { ...base, id }
  if (!input.title || !input.excerpt || !input.content || !input.category) {
    return { ok: false as const, error: "Title, excerpt, content, and category are required" }
  }
  await updatePost(input)
  revalidatePath("/")
  revalidatePath("/blog")
  revalidatePath(`/blog/${input.slug || ""}`)
  revalidatePath("/admin")
  revalidatePath("/admin/posts")
  return { ok: true as const, error: null, savedAt: Date.now() }
}

export async function deletePostAction(formData: FormData) {
  await requireSession()
  const id = Number(formData.get("id") || 0)
  if (!id) return
  await deletePost(id)
  revalidatePath("/")
  revalidatePath("/blog")
  revalidatePath("/admin/posts")
  redirect("/admin/posts")
}
