import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

// PUT - Update an insurer contact
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    if (!["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { contact_name, contact_email, contact_role, is_primary, is_active, notes } = body

    const [contact] = await sql`
      UPDATE insurer_contacts SET
        contact_name = COALESCE(${contact_name}, contact_name),
        contact_email = COALESCE(${contact_email}, contact_email),
        contact_role = COALESCE(${contact_role}, contact_role),
        is_primary = COALESCE(${is_primary}, is_primary),
        is_active = COALESCE(${is_active}, is_active),
        notes = COALESCE(${notes}, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    return NextResponse.json(contact)
  } catch (error) {
    console.error("Insurer contacts PUT error:", error)
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 })
  }
}

// DELETE - Deactivate a contact
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    if (!["Admin", "Ensuredit"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params
    await sql`UPDATE insurer_contacts SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Insurer contacts DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 })
  }
}
