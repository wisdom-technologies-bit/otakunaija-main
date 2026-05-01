"use server"

import { sql } from "@/lib/db"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ContactInput = {
  name: string
  email: string
  subject: string
  message: string
}

export async function sendContactMessage(input: ContactInput): Promise<{ ok: boolean; message: string }> {
  const name = input.name?.trim()
  const email = input.email?.trim().toLowerCase()
  const subject = input.subject?.trim() ?? ""
  const message = input.message?.trim()

  if (!name || name.length < 2) return { ok: false, message: "Please enter your name." }
  if (!email || !EMAIL_RE.test(email)) return { ok: false, message: "Please enter a valid email address." }
  if (!message || message.length < 10) return { ok: false, message: "Message must be at least 10 characters." }
  if (message.length > 5000) return { ok: false, message: "Message is too long (max 5000 chars)." }

  try {
    await sql`
      INSERT INTO contact_messages (name, email, subject, message)
      VALUES (${name}, ${email}, ${subject}, ${message})
    `
    return { ok: true, message: "Thanks! We'll get back to you within 48 hours." }
  } catch (err) {
    console.error("[v0] contact error:", err)
    return { ok: false, message: "Something went wrong. Please try again." }
  }
}
