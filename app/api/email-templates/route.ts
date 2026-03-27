import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

// GET - List active email templates
export async function GET() {
  try {
    const user = await verifyAuth()
    if (!["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const templates = await sql`
      SELECT * FROM email_templates
      WHERE is_deleted = false AND is_active = true
      ORDER BY category, name
    `

    return NextResponse.json(templates)
  } catch (error) {
    console.error("Email templates GET error:", error)
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }
}

// POST - Create a new email template (Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth()
    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Only admins can create templates" }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, category, subject_template, body_template, available_variables } = body

    if (!name || !subject_template || !body_template) {
      return NextResponse.json({ error: "name, subject_template, and body_template are required" }, { status: 400 })
    }

    const [template] = await sql`
      INSERT INTO email_templates (
        name, description, category, subject_template, body_template,
        available_variables, created_by_id, created_by_name
      ) VALUES (
        ${name}, ${description || null}, ${category || "General"},
        ${subject_template}, ${body_template},
        ${JSON.stringify(available_variables || [])},
        ${user.userId}, ${user.name}
      )
      RETURNING *
    `

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error("Email templates POST error:", error)
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 })
  }
}
