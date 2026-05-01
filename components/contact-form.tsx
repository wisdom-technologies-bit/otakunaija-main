"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { sendContactMessage } from "@/app/actions/contact"

export function ContactForm() {
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" })

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await sendContactMessage(form)
      if (res.ok) {
        toast.success(res.message)
        setForm({ name: "", email: "", subject: "", message: "" })
      } else {
        toast.error(res.message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Your name"
              className="bg-card border-border"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="you@example.com"
              className="bg-card border-border"
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="subject">Subject</FieldLabel>
          <Input
            id="subject"
            value={form.subject}
            onChange={(e) => set("subject", e.target.value)}
            placeholder="What's this about?"
            className="bg-card border-border"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="message">Message</FieldLabel>
          <Textarea
            id="message"
            required
            minLength={10}
            rows={6}
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="Tell us what's on your mind..."
            className="bg-card border-border"
          />
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {pending ? (
          <>
            <Spinner className="size-4 mr-2" /> Sending...
          </>
        ) : (
          "Send message"
        )}
      </Button>
    </form>
  )
}
