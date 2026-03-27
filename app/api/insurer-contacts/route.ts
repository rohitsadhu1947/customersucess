import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

// GET - List insurer contacts (optionally filter by insurer_id)
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth()
    if (!["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const insurerId = searchParams.get("insurer_id")

    let contacts
    if (insurerId) {
      contacts = await sql`
        SELECT ic.*, i.name as insurer_name, i.short_name as insurer_short_name
        FROM insurer_contacts ic
        LEFT JOIN insurers i ON ic.insurer_id = i.id
        WHERE ic.insurer_id = ${insurerId} AND ic.is_active = true
        ORDER BY ic.is_primary DESC, ic.contact_name
      `
    } else {
      contacts = await sql`
        SELECT ic.*, i.name as insurer_name, i.short_name as insurer_short_name
        FROM insurer_contacts ic
        LEFT JOIN insurers i ON ic.insurer_id = i.id
        WHERE ic.is_active = true
        ORDER BY i.name, ic.is_primary DESC, ic.contact_name
      `
    }

    return NextResponse.json(contacts)
  } catch (error) {
    console.error("Insurer contacts GET error:", error)
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 })
  }
}

// POST - Create a new insurer contact
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth()
    if (!["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { insurer_id, contact_name, contact_email, contact_role, is_primary, notes } = body

    if (!insurer_id || !contact_email) {
      return NextResponse.json({ error: "insurer_id and contact_email are required" }, { status: 400 })
    }

    const [contact] = await sql`
      INSERT INTO insurer_contacts (
        insurer_id, contact_name, contact_email, contact_role, is_primary, notes
      ) VALUES (
        ${insurer_id}, ${contact_name || null}, ${contact_email},
        ${contact_role || null}, ${is_primary || false}, ${notes || null}
      )
      RETURNING *
    `

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    console.error("Insurer contacts POST error:", error)
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 })
  }
}
