"use client"

import { useActionState } from "react"
import { Mail, Lock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction } from "@/app/actions/admin"

type LoginState = { ok: boolean; error?: string } | null

export function LoginForm({ from }: { from?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    async (_prev, formData) => {
      const result = await loginAction(_prev, formData)
      return result ?? null
    },
    null,
  )

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="from" value={from || "/admin"} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="support@otakunaija.name.ng"
            required
            autoComplete="email"
            className="pl-9"
            defaultValue="support@otakunaija.name.ng"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            className="pl-9"
          />
        </div>
      </div>
      {state?.error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  )
}
