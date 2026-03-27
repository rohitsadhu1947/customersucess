import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

// PUT - Update a template
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Only admins can update templates" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, description, category, subject_template, body_template, available_variables, is_active } = body

    const [template] = await sql`
      UPDATE email_templates SET
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        category = COALESCE(${category}, category),
        subject_template = COALESCE(${subject_template}, subject_template),
        body_template = COALESCE(${body_template}, body_template),
        available_variables = COALESCE(${available_variables ? JSON.stringify(available_variables) : null}, available_variables),
        is_active = COALESCE(${is_active}, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND is_deleted = false
      RETURNING *
    `

    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 })
    return NextResponse.json(template)
  } catch (error) {
    console.error("Email templates PUT error:", error)
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
  }
}

// DELETE - Soft delete a template
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Only admins can delete templates" }, { status: 403 })
    }

    const { id } = await params
    await sql`UPDATE email_templates SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Email templates DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 })
  }
}
