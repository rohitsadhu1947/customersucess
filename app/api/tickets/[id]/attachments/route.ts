import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import {
  ATTACHMENT_MAX_FILE_SIZE,
  ATTACHMENT_MAX_FILES_PER_UPLOAD,
  isAllowedFileType,
} from "@/lib/validations"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    const isCustomer = user.role === "Customer" || user.role === "Customer View Only"

    // Verify ticket access
    if (isCustomer) {
      const ticketCheck = await sql`
        SELECT id FROM tickets WHERE id = ${id} AND company_id = ${user.companyId}
          AND (is_deleted = false OR is_deleted IS NULL)
      `
      if (ticketCheck.length === 0) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
      }
    }

    // Return metadata only (NOT file_data) to avoid huge payloads
    const attachments = await sql`
      SELECT id, ticket_id, response_id, file_name, file_type, file_size,
             uploaded_by_id, uploaded_by_name, created_at
      FROM ticket_attachments
      WHERE ticket_id = ${id}
        AND (is_deleted = false OR is_deleted IS NULL)
      ORDER BY created_at ASC
    `

    return NextResponse.json(attachments)
  } catch (error) {
    console.error("Attachments GET error:", error)
    return NextResponse.json({ error: "Failed to fetch attachments" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    // Customer View Only cannot upload
    if (user.role === "Customer View Only") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const isCustomer = user.role === "Customer"

    // Verify ticket access
    let ticketRows
    if (isCustomer) {
      ticketRows = await sql`
        SELECT id FROM tickets WHERE id = ${id} AND company_id = ${user.companyId}
          AND (is_deleted = false OR is_deleted IS NULL)
      `
    } else {
      ticketRows = await sql`
        SELECT id FROM tickets WHERE id = ${id}
          AND (is_deleted = false OR is_deleted IS NULL)
      `
    }
    if (ticketRows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    // Parse FormData
    const formData = await request.formData()
    const responseId = formData.get("response_id") as string | null
    const files = formData.getAll("files") as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }
    if (files.length > ATTACHMENT_MAX_FILES_PER_UPLOAD) {
      return NextResponse.json(
        { error: `Maximum ${ATTACHMENT_MAX_FILES_PER_UPLOAD} files per upload` },
        { status: 400 },
      )
    }

    // Validate response_id if provided
    if (responseId) {
      const responseCheck = await sql`
        SELECT id FROM ticket_responses WHERE id = ${responseId} AND ticket_id = ${id}
      `
      if (responseCheck.length === 0) {
        return NextResponse.json({ error: "Response not found" }, { status: 404 })
      }
    }

    const uploaded = []

    for (const file of files) {
      // Validate size
      if (file.size > ATTACHMENT_MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 5MB limit` },
          { status: 400 },
        )
      }

      // Validate type
      if (!isAllowedFileType(file.type, file.name)) {
        return NextResponse.json(
          { error: `File type not allowed: ${file.name}` },
          { status: 400 },
        )
      }

      // Convert to base64
      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString("base64")

      // Insert into DB
      const result = await sql`
        INSERT INTO ticket_attachments (
          ticket_id, response_id, file_name, file_type, file_size,
          file_data, uploaded_by_id, uploaded_by_name
        ) VALUES (
          ${id}, ${responseId || null}, ${file.name}, ${file.type}, ${file.size},
          ${base64}, ${user.userId}, ${user.name}
        )
        RETURNING id, ticket_id, response_id, file_name, file_type, file_size,
                  uploaded_by_id, uploaded_by_name, created_at
      `
      uploaded.push(result[0])
    }

    await logAudit({
      userId: user.userId,
      action: "create",
      entityType: "ticket_attachment",
      entityId: id,
      details: { count: uploaded.length, files: uploaded.map((f: Record<string, unknown>) => f.file_name) },
    })

    return NextResponse.json(uploaded, { status: 201 })
  } catch (error) {
    console.error("Attachments POST error:", error)
    return NextResponse.json({ error: "Failed to upload attachments" }, { status: 500 })
  }
}
