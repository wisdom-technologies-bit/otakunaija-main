import { NextResponse } from "next/server"
import { drainPushOutbox } from "@/lib/push"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`)
}

async function handle(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(request.url)
  const result = await drainPushOutbox({ dry: url.searchParams.get("dry") === "1" })
  return NextResponse.json(result)
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
