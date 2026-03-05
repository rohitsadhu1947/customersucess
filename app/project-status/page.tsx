"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ProjectStatusRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/issues")
  }, [router])

  return null
}
