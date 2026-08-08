"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

export interface CommentUser {
  token: string
  username: string
}

interface AuthContextType {
  user: CommentUser | null
  login: (email: string, name?: string) => Promise<CommentUser>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CommentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("otaku_comment_user")
      if (stored) {
        setUser(JSON.parse(stored))
      }
    } catch (e) {
      console.error("Failed to parse stored user", e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, name?: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    })
    if (!res.ok) {
      throw new Error("Login failed")
    }
    const data = await res.json()
    if (data.token) {
      const userData: CommentUser = { token: data.token, username: data.username }
      localStorage.setItem("otaku_comment_user", JSON.stringify(userData))
      setUser(userData)
      return userData
    }
    throw new Error("Invalid response")
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("otaku_comment_user")
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}