import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { rejectAniListMatch } from "@/lib/anilist-backfill"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const ok = await rejectAniListMatch(Number((await params).id))
  if (!ok) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
  return NextResponse.json({ rejected: true })
}
