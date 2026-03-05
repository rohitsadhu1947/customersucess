"use client"

import type React from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const publicPaths = ["/login", "/forgot-password", "/reset-password"]
  const isPublicPath = publicPaths.includes(pathname)

  useEffect(() => {
    if (!loading && !user && !isPublicPath) {
      router.push("/login")
    }
  }, [user, loading, pathname, router, isPublicPath])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user && !isPublicPath) {
    return null
  }

  return <>{children}</>
}
