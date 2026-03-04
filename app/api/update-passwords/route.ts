import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

const sql = neon(process.env.DATABASE_URL!)

async function updatePasswords() {
  try {
    // Hash the password 'admin123' with the same method our login uses
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
      hashedPassword: hashedPassword, // For debugging
    })
  } catch (error) {
    console.error("Password update error:", error)
    return NextResponse.json({ error: "Failed to update passwords", details: error.message }, { status: 500 })
  }
}

// Accept both GET and POST
export async function GET() {
  return updatePasswords()
}

export async function POST() {
  return updatePasswords()
}
