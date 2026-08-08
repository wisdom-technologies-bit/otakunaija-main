import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { commentUsers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { randomBytes } from "crypto"

export function generateToken(): string {
  return randomBytes(32).toString("hex")
}

export async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")?.replace("Bearer ", "")
  if (!authHeader) return null

  const [user] = await db
    .select()
    .from(commentUsers)
    .where(eq(commentUsers.token, authHeader))
    .limit(1)

  return user ?? null
}