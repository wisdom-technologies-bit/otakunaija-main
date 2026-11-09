import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, unauthorized } from "@/lib/newsletter/admin"
import { getSetting, setSetting } from "@/lib/newsletter/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** The pause switch. Sending checks this row before every run. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return unauthorized()

  const body = (await request.json().catch(() => ({}))) as { paused?: boolean }
  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ error: "paused must be true or false" }, { status: 400 })
  }

  await setSetting("paused", body.paused ? "true" : "false")
  const paused = await getSetting("paused")

  return NextResponse.json({ ok: true, paused: paused === "true" })
}
