import { NextRequest, NextResponse } from "next/server"
import { unsubscribeByToken } from "@/lib/newsletter/subscribe"
import { subscribeStore } from "@/lib/newsletter/runtime"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * RFC 8058 one-click unsubscribe.
 *
 * The `List-Unsubscribe` header points here, and mail clients POST
 * `List-Unsubscribe=One-Click` to it with no user interaction. That is why this
 * is a route handler rather than the styled page: the page cannot accept a POST
 * from Gmail, and the header must not point at something that only answers GET.
 *
 * GET redirects to the human page so a link pasted into an address bar still
 * works.
 */
export async function POST(request: NextRequest) {
  const token = (request.nextUrl.searchParams.get("token") ?? "").trim()
  if (!token) return new NextResponse("Missing token", { status: 400 })

  const result = await unsubscribeByToken(token, "one-click", { store: subscribeStore, now: new Date() })
  if (!result.ok) return new NextResponse("Invalid token", { status: 404 })

  return NextResponse.json({ ok: true, status: "unsubscribed" }, { status: 200 })
}

export async function GET(request: NextRequest) {
  const token = (request.nextUrl.searchParams.get("token") ?? "").trim()
  const target = new URL("/newsletter/unsubscribe", request.nextUrl.origin)
  if (token) target.searchParams.set("token", token)
  return NextResponse.redirect(target, { status: 302 })
}
