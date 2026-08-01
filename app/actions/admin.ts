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
import {
  createCreator,
  updateCreator,
  deleteCreator,
  createSeries,
  updateSeries,
  deleteSeries,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  type CreateCreatorInput,
  type UpdateCreatorInput,
  type CreateSeriesInput,
  type UpdateSeriesInput,
  type CreateEpisodeInput,
  type UpdateEpisodeInput,
} from "@/lib/db/queries"

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
  revalidatePath("/admin/posts")
  return { ok: true as const, error: null, savedAt: Date.now() }
}

// ============ CREATORS ACTIONS ============

export async function createCreatorAction(_prev: unknown, formData: FormData) {
  await requireSession()
  const input: CreateCreatorInput = {
    name: String(formData.get("name") || "").trim(),
    slug: String(formData.get("slug") || "").trim() || undefined,
    bio: String(formData.get("bio") || "").trim() || null,
    avatar_url: String(formData.get("avatar_url") || "").trim() || null,
    facebook_url: String(formData.get("facebook_url") || "").trim() || null,
  }

  if (!input.name) {
    return { ok: false as const, error: "Creator name is required" }
  }

  const creator = await createCreator(input)
  revalidatePath("/admin/creators")
  redirect(`/admin/creators/${creator.id}/edit?created=1`)
}

export async function updateCreatorAction(_prev: unknown, formData: FormData) {
  await requireSession()
  const id = Number(formData.get("id") || 0)
  if (!id) return { ok: false as const, error: "Missing creator id" }

  const input: UpdateCreatorInput = {
    id,
    name: String(formData.get("name") || "").trim(),
    slug: String(formData.get("slug") || "").trim() || undefined,
    bio: String(formData.get("bio") || "").trim() || null,
    avatar_url: String(formData.get("avatar_url") || "").trim() || null,
    facebook_url: String(formData.get("facebook_url") || "").trim() || null,
  }

  if (!input.name) {
    return { ok: false as const, error: "Creator name is required" }
  }

  await updateCreator(input)
  revalidatePath("/admin/creators")
  return { ok: true as const, error: null, savedAt: Date.now() }
}

export async function deleteCreatorAction(formData: FormData) {
  await requireSession()
  const id = Number(formData.get("id") || 0)
  if (!id) throw new Error("Missing creator id")

  try {
    await deleteCreator(id)
    revalidatePath("/admin/creators")
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Failed to delete" }
  }
}

// ============ SERIES ACTIONS ============

export async function createSeriesAction(_prev: unknown, formData: FormData) {
  await requireSession()
  const input: CreateSeriesInput = {
    creator_id: Number(formData.get("creator_id") || 0),
    title: String(formData.get("title") || "").trim(),
    slug: String(formData.get("slug") || "").trim() || undefined,
    synopsis: String(formData.get("synopsis") || "").trim() || null,
    cover_image_url: String(formData.get("cover_image_url") || "").trim() || null,
    poster_image_url: String(formData.get("poster_image_url") || "").trim() || null,
    status: (String(formData.get("status") || "ongoing").trim() as "ongoing" | "completed") || "ongoing",
    genre: String(formData.get("genre") || "").trim() || null,
  }

  if (!input.creator_id || !input.title) {
    return { ok: false as const, error: "Creator and title are required" }
  }

  const series = await createSeries(input)
  revalidatePath("/admin/series")
  redirect(`/admin/series/${series.id}/edit?created=1`)
}

export async function updateSeriesAction(_prev: unknown, formData: FormData) {
  await requireSession()
  const id = Number(formData.get("id") || 0)
  if (!id) return { ok: false as const, error: "Missing series id" }

  const input: UpdateSeriesInput = {
    id,
    creator_id: Number(formData.get("creator_id") || 0),
    title: String(formData.get("title") || "").trim(),
    slug: String(formData.get("slug") || "").trim() || undefined,
    synopsis: String(formData.get("synopsis") || "").trim() || null,
    cover_image_url: String(formData.get("cover_image_url") || "").trim() || null,
    poster_image_url: String(formData.get("poster_image_url") || "").trim() || null,
    status: (String(formData.get("status") || "ongoing").trim() as "ongoing" | "completed") || "ongoing",
    genre: String(formData.get("genre") || "").trim() || null,
  }

  if (!input.creator_id || !input.title) {
    return { ok: false as const, error: "Creator and title are required" }
  }

  await updateSeries(input)
  revalidatePath("/admin/series")
  return { ok: true as const, error: null, savedAt: Date.now() }
}

export async function deleteSeriesAction(formData: FormData) {
  await requireSession()
  const id = Number(formData.get("id") || 0)
  if (!id) throw new Error("Missing series id")

  try {
    await deleteSeries(id)
    revalidatePath("/admin/series")
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Failed to delete" }
  }
}

// ============ EPISODES ACTIONS ============

export async function createEpisodeAction(_prev: unknown, formData: FormData) {
  await requireSession()
  const input: CreateEpisodeInput = {
    series_id: Number(formData.get("series_id") || 0),
    episode_number: Number(formData.get("episode_number") || 0),
    title: String(formData.get("title") || "").trim(),
    slug: String(formData.get("slug") || "").trim() || undefined,
    synopsis: String(formData.get("synopsis") || "").trim() || null,
    video_public_id: String(formData.get("video_public_id") || "").trim(),
    video_url: String(formData.get("video_url") || "").trim(),
    thumbnail_url: String(formData.get("thumbnail_url") || "").trim(),
    duration_seconds: Number(formData.get("duration_seconds") || 0) || null,
    subtitles_url: String(formData.get("subtitles_url") || "").trim() || null,
  }

  // Validate all required fields
  if (!input.series_id) {
    return { ok: false as const, error: "Series is required" }
  }
  if (!input.episode_number) {
    return { ok: false as const, error: "Episode number is required" }
  }
  if (!input.title) {
    return { ok: false as const, error: "Title is required" }
  }
  if (!input.video_url) {
    return { ok: false as const, error: "Video upload is required. Please upload a video before saving." }
  }
  if (!input.video_public_id) {
    return { ok: false as const, error: "Video public ID is missing. Please re-upload the video." }
  }
  if (!input.thumbnail_url) {
    return { ok: false as const, error: "Video thumbnail is missing. Please re-upload the video." }
  }

  try {
    const episode = await createEpisode(input)
    revalidatePath("/admin/episodes")
    redirect(`/admin/episodes/${episode.id}/edit?created=1`)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create episode"
    return { ok: false as const, error: message }
  }
}

export async function updateEpisodeAction(_prev: unknown, formData: FormData) {
  await requireSession()
  const id = Number(formData.get("id") || 0)
  if (!id) return { ok: false as const, error: "Missing episode id" }

  const input: UpdateEpisodeInput = {
    id,
    series_id: Number(formData.get("series_id") || 0),
    episode_number: Number(formData.get("episode_number") || 0),
    title: String(formData.get("title") || "").trim(),
    slug: String(formData.get("slug") || "").trim() || undefined,
    synopsis: String(formData.get("synopsis") || "").trim() || null,
    video_public_id: String(formData.get("video_public_id") || "").trim(),
    video_url: String(formData.get("video_url") || "").trim(),
    thumbnail_url: String(formData.get("thumbnail_url") || "").trim(),
    duration_seconds: Number(formData.get("duration_seconds") || 0) || null,
    subtitles_url: String(formData.get("subtitles_url") || "").trim() || null,
  }

  // Validate all required fields
  if (!input.series_id) {
    return { ok: false as const, error: "Series is required" }
  }
  if (!input.episode_number) {
    return { ok: false as const, error: "Episode number is required" }
  }
  if (!input.title) {
    return { ok: false as const, error: "Title is required" }
  }
  if (!input.video_url) {
    return { ok: false as const, error: "Video upload is required. Please upload a video before saving." }
  }
  if (!input.video_public_id) {
    return { ok: false as const, error: "Video public ID is missing. Please re-upload the video." }
  }
  if (!input.thumbnail_url) {
    return { ok: false as const, error: "Video thumbnail is missing. Please re-upload the video." }
  }

  try {
    await updateEpisode(input)
    revalidatePath("/admin/episodes")
    return { ok: true as const, error: null, savedAt: Date.now() }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update episode"
    return { ok: false as const, error: message }
  }
}

export async function deleteEpisodeAction(formData: FormData) {
  await requireSession()
  const id = Number(formData.get("id") || 0)
  if (!id) throw new Error("Missing episode id")

  await deleteEpisode(id)
  revalidatePath("/admin/episodes")
}

export async function deletePostAction(formData: FormData) {
  await requireSession()
  const id = Number(formData.get("id") || 0)
  if (!id) return
  await deletePost(id)
  revalidatePath("/admin/posts")
  redirect("/admin/posts")
}
