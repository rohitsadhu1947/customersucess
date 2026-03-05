import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"

async function updatePasswords() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  try {
    const hashedPassword = await bcrypt.hash("admin123", 12)

    // Update password hashes for the demo users
    const updatedUsers = await sql`
      UPDATE users 
      SET password_hash = ${hashedPassword}
      WHERE email IN ('admin@ensuredit.com', 'rajesh@abcinsurance.com', 'john@ensuredit.com')
      RETURNING email, name, role_type
    `

    return NextResponse.json({
      success: true,
      message: "Password hashes updated successfully",
      updatedUsers: updatedUsers,
    })
  } catch (error) {
    console.error("Password update error:", error)
    return NextResponse.json({ error: "Failed to update passwords" }, { status: 500 })
  }
}

// Accept both GET and POST
export async function GET() {
  return updatePasswords()
}

export async function POST() {
  return updatePasswords()
}
