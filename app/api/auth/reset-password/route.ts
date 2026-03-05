import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      )
    }

    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex")

    // Find user with matching token that hasn't expired
    const users = await sql`
      SELECT id FROM users
      WHERE password_reset_token = ${hashedToken}
        AND password_reset_expires > NOW()
    `

    if (users.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired reset token. Please request a new password reset link." },
        { status: 400 }
      )
    }

    const user = users[0]

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12)

    // Update password and clear reset token fields
    await sql`
      UPDATE users
      SET password_hash = ${passwordHash},
          password_reset_token = NULL,
          password_reset_expires = NULL
      WHERE id = ${user.id}
    `

    return NextResponse.json({
      message: "Password has been reset successfully.",
    })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { error: "Failed to reset password. Please try again." },
      { status: 500 }
    )
  }
}
