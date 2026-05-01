"use server"

import { sql } from "@/lib/db"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function subscribeToNewsletter(email: string): Promise<{ ok: boolean; message: string }> {
  const value = (email ?? "").trim().toLowerCase()
  if (!value || !EMAIL_RE.test(value)) {
    return { ok: false, message: "Please enter a valid email address." }
  }
  try {
    const existing = await sql`SELECT id FROM subscribers WHERE email = ${value} LIMIT 1`
    if (existing.length > 0) {
      return { ok: true, message: "You're already subscribed — thanks for sticking around!" }
    }
    await sql`INSERT INTO subscribers (email) VALUES (${value})`
    return { ok: true, message: "You're in! Welcome to OtakuNaija." }
  } catch (err) {
    console.error("[v0] newsletter error:", err)
    return { ok: false, message: "Something went wrong. Try again in a moment." }
  }
}
