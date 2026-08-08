import { NextRequest, NextResponse } from "next/server"
import { registerOrLogin } from "@/lib/db/queries/comments"

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json()
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const result = await registerOrLogin(email, name || undefined)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}