import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

const sql = neon(process.env.DATABASE_URL!)

export async function POST() {
  try {
    // Hash the password 'admin123'
    const hashedPassword = await bcrypt.hash("admin123", 12)

    // First, let's check if companies exist and create them if they don't
    const companies = await sql`
      INSERT INTO companies (name, status, customer_since, ensuredit_lead_name, client_lead_name, client_lead_email)
      VALUES 
        ('Ensuredit', 'Active', '2020-01-01', 'Internal', 'Internal', 'admin@ensuredit.com'),
        ('ABC Insurance', 'Active', '2023-06-15', 'John Smith', 'Rajesh Kumar', 'rajesh@abcinsurance.com')
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `

    const ensureditCompany = companies.find((c) => c.name === "Ensuredit")
    const abcInsuranceCompany = companies.find((c) => c.name === "ABC Insurance")

    // Create or update demo users
    const users = await sql`
      INSERT INTO users (email, name, password_hash, role_type, is_active, company_id, email_verified, two_factor_enabled)
      VALUES 
        ('admin@ensuredit.com', 'Admin User', ${hashedPassword}, 'Admin', true, ${ensureditCompany?.id}, true, false),
        ('john@ensuredit.com', 'John Smith', ${hashedPassword}, 'Ensuredit Client Lead', true, ${ensureditCompany?.id}, true, false),
        ('rajesh@abcinsurance.com', 'Rajesh Kumar', ${hashedPassword}, 'Customer', true, ${abcInsuranceCompany?.id}, true, false)
      ON CONFLICT (email) DO UPDATE SET 
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        role_type = EXCLUDED.role_type,
        is_active = EXCLUDED.is_active,
        company_id = EXCLUDED.company_id
      RETURNING email, name, role_type
    `

    return NextResponse.json({
      success: true,
      message: "Demo users created successfully",
      users: users,
      hashedPassword: hashedPassword, // For debugging
    })
  } catch (error) {
    console.error("Seeding error:", error)
    return NextResponse.json({ error: "Failed to seed users", details: error.message }, { status: 500 })
  }
}
