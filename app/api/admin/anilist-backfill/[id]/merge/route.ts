import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { mergeAniListMatch } from "@/lib/anilist-backfill"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const id = Number((await params).id)
  const body = await request.json().catch(() => null)
  const keepSeriesId = Number(body?.keepSeriesId)
  const discardSeriesId = Number(body?.discardSeriesId)
  if (!Number.isInteger(id) || !Number.isInteger(keepSeriesId) || !Number.isInteger(discardSeriesId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const result = await mergeAniListMatch(id, keepSeriesId, discardSeriesId)
  if (!result) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
  if (result === "invalid-pair") return NextResponse.json({ error: "Series do not match candidate" }, { status: 400 })
  return NextResponse.json(result)
}
