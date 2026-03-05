import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { createToken } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { email, password, rememberMe } = await request.json()

    // Query database for user
    const users = await sql`
      SELECT 
        u.id, u.email, u.name, u.password_hash, u.role_type, 
        u.is_active, u.company_id,
        c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.email = ${email} AND u.is_active = true
    `

    if (users.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const user = users[0]

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Update last login
    await sql`
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = ${user.id}
    `

    const expirationTime = rememberMe ? "30d" : "24h"
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24

    const token = await createToken({
      userId: user.id.toString(),
      email: user.email,
      name: user.name,
      role: user.role_type,
      companyId: user.company_id?.toString(),
      companyName: user.company_name,
    }, expirationTime)

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
    })

    return NextResponse.json({
      user: {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        role: user.role_type,
        companyId: user.company_id?.toString(),
        companyName: user.company_name,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
