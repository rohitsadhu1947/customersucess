import { NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"

export async function GET() {
  try {
    const payload = await verifyAuth()
    return NextResponse.json({
      user: {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        companyId: payload.companyId,
        companyName: payload.companyName,
      },
    })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
