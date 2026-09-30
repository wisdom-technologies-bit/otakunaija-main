import { ADMIN_EMAIL, getCurrentSession } from "@/lib/auth"
import { NextResponse } from "next/server"

const NEWS_TIMEOUT_MS = 15_000

type NewsMethod = "GET" | "POST"

export async function requireAdminNewsSession() {
  const session = await getCurrentSession()
  if (!session || session.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  return null
}

export async function proxyNewsRequest(path: string, method: NewsMethod, search?: string) {
  const baseUrl = process.env.NEWS_API_URL
  const apiKey = process.env.NEWS_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error("NEWS_API_URL and NEWS_API_KEY are required")
  }

  const url = new URL(path, `${baseUrl.replace(/\/$/, "")}/`)
  if (search) url.search = search

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: { "X-News-Api-Key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(NEWS_TIMEOUT_MS),
    })
  } catch {
    return NextResponse.json({ error: "NEWS_SERVICE_UNAVAILABLE" }, { status: 502 })
  }

  const body = await response.arrayBuffer()
  const headers = new Headers()
  const contentType = response.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)

  return new Response(body, { status: response.status, headers })
}

export function internalErrorResponse() {
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
}
