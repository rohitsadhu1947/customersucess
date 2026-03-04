"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

interface User {
  id: string
  email: string
  name: string
  role: string
  companyId?: string
  companyName?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  loading: boolean
  hasPermission: (resource: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Role-based permissions
const ROLE_PERMISSIONS = {
  Admin: ["dashboard", "integrations", "issues", "reports", "companies", "users", "master-data", "settings"],
  Ensuredit: ["dashboard", "integrations", "issues", "reports", "companies", "users", "master-data"],
  "Ensuredit Client Lead": ["dashboard", "integrations", "issues", "reports", "companies", "users"],
  Customer: ["dashboard", "integrations", "issues", "reports"],
  "Customer View Only": ["dashboard", "reports"],
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const hasPermission = (resource: string): boolean => {
    if (!user) return false
    const permissions = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS]
    return permissions?.includes(resource) || false
  }

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem("ensuredit-user")
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser)
        setUser(userData)
      } catch (error) {
        console.error("Error parsing stored user:", error)
        localStorage.removeItem("ensuredit-user")
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // Redirect logic - only run when not loading
    if (!loading) {
      if (!user && pathname !== "/login") {
        router.push("/login")
      } else if (user && pathname === "/login") {
        router.push("/")
      } else if (user && pathname !== "/login") {
        // Check if user has permission for current path
        const currentSection = pathname.split("/")[1] || "dashboard"
        const hasAccess = hasPermission(currentSection)

        if (!hasAccess) {
          router.push("/")
        }
      }
    }
  }, [user, loading, pathname, router])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)

        // Store user in localStorage for client-side state persistence
        localStorage.setItem("ensuredit-user", JSON.stringify(data.user))

        router.push("/")
        return true
      } else {
        return false
      }
    } catch (error) {
      console.error("Login error:", error)
      return false
    }
  }

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      })
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setUser(null)
      localStorage.removeItem("ensuredit-user")
      router.push("/login")
    }
  }

  return <AuthContext.Provider value={{ user, login, logout, loading, hasPermission }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
