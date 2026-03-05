import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { logAudit } from "@/lib/audit"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const user = await verifyAuth()
    const { id, attachmentId } = await params

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

    const attachments = await sql`
      SELECT * FROM ticket_attachments
      WHERE id = ${attachmentId} AND ticket_id = ${id}
        AND (is_deleted = false OR is_deleted IS NULL)
    `

    if (attachments.length === 0) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    const attachment = attachments[0]
    const buffer = Buffer.from(attachment.file_data, "base64")

    return new Response(buffer, {
      headers: {
        "Content-Type": attachment.file_type,
        "Content-Disposition": `inline; filename="${attachment.file_name}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    console.error("Attachment download error:", error)
    return NextResponse.json({ error: "Failed to download attachment" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const user = await verifyAuth()
    const { id, attachmentId } = await params

    if (user.role === "Customer View Only") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const attachments = await sql`
      SELECT * FROM ticket_attachments
      WHERE id = ${attachmentId} AND ticket_id = ${id}
        AND (is_deleted = false OR is_deleted IS NULL)
    `

    if (attachments.length === 0) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    const attachment = attachments[0]
    const isEnsuredit = ["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user.role)

    // Only the uploader or Ensuredit team can delete
    if (!isEnsuredit && attachment.uploaded_by_id !== user.userId) {
      return NextResponse.json({ error: "Cannot delete another user's attachment" }, { status: 403 })
    }

    await sql`
      UPDATE ticket_attachments SET is_deleted = true WHERE id = ${attachmentId}
    `

    await logAudit({
      userId: user.userId,
      action: "delete",
      entityType: "ticket_attachment",
      entityId: attachmentId,
      details: { ticket_id: id, file_name: attachment.file_name },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Attachment delete error:", error)
    return NextResponse.json({ error: "Failed to delete attachment" }, { status: 500 })
  }
}
