import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Look up user by email
    const users = await sql`
      SELECT id, email FROM users
      WHERE email = ${email} AND is_active = true
    `

    if (users.length > 0) {
      const user = users[0]

      // Generate a random token
      const resetToken = crypto.randomUUID()

      // Hash the token before storing
      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex")

      // Store hashed token and expiry (1 hour from now)
      await sql`
        UPDATE users
        SET password_reset_token = ${hashedToken},
            password_reset_expires = NOW() + INTERVAL '1 hour'
        WHERE id = ${user.id}
      `

      // Log the reset link (no email service yet)
      console.error(`Password reset link: /reset-password?token=${resetToken}`)
    }

    // Always return success to avoid leaking whether email exists
    return NextResponse.json({
      message: "If an account exists with that email, you will receive a password reset link.",
    })
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json({
      message: "If an account exists with that email, you will receive a password reset link.",
    })
  }
}
