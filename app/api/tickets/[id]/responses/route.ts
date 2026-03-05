import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { validateBody, createTicketResponseSchema } from "@/lib/validations"
import { logAudit } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"

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

    let responses
    if (isCustomer) {
      // Customers don't see internal notes
      responses = await sql`
        SELECT * FROM ticket_responses
        WHERE ticket_id = ${id}
          AND response_type != 'internal_note'
          AND (is_deleted = false OR is_deleted IS NULL)
        ORDER BY created_at ASC
      `
    } else {
      responses = await sql`
        SELECT * FROM ticket_responses
        WHERE ticket_id = ${id}
          AND (is_deleted = false OR is_deleted IS NULL)
        ORDER BY created_at ASC
      `
    }

    return NextResponse.json(responses)
  } catch (error) {
    console.error("Ticket responses GET error:", error)
    return NextResponse.json({ error: "Failed to fetch responses" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    if (user.role === "Customer View Only") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const isCustomer = user.role === "Customer"
    const isEnsuredit = user.role === "Admin" || user.role === "Ensuredit" || user.role === "Ensuredit Client Lead"

    // Verify ticket access
    let ticketRows
    if (isCustomer) {
      ticketRows = await sql`
        SELECT * FROM tickets WHERE id = ${id} AND company_id = ${user.companyId}
          AND (is_deleted = false OR is_deleted IS NULL)
      `
    } else {
      ticketRows = await sql`
        SELECT * FROM tickets WHERE id = ${id}
          AND (is_deleted = false OR is_deleted IS NULL)
      `
    }

    if (ticketRows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const ticket = ticketRows[0]

    const body = await request.json()
    const validation = validateBody(createTicketResponseSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const data = validation.data

    // Customers can only post replies (not internal notes)
    const responseType = isCustomer ? "reply" : data.response_type

    // Insert response
    const result = await sql`
      INSERT INTO ticket_responses (ticket_id, response_type, body, created_by_id, created_by_name, created_by_role)
      VALUES (${id}, ${responseType}, ${data.body.trim()}, ${user.userId}, ${user.name}, ${user.role})
      RETURNING *
    `

    // Auto-status changes
    let statusChanged = false
    let newStatus = ticket.status

    if (isEnsuredit && responseType === "reply") {
      // First Ensuredit reply: set first_response_at
      if (!ticket.first_response_at) {
        await sql`
          UPDATE tickets SET first_response_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
        `

        // Check SLA response breach
        const responseHours: Record<string, number> = { Critical: 1, High: 4, Medium: 24, Low: 48 }
        const targetHours = responseHours[ticket.priority] || 24
        const created = new Date(ticket.created_at)
        const deadline = new Date(created)
        deadline.setHours(deadline.getHours() + targetHours)
        if (new Date() > deadline) {
          await sql`UPDATE tickets SET sla_response_breach = true WHERE id = ${id}`
        }
      }

      // Auto-change status from "New" to "Open"
      if (ticket.status === "New") {
        newStatus = "Open"
        statusChanged = true
      }
    }

    if (isCustomer && responseType === "reply") {
      // Customer reply on "Waiting on Customer" -> "Open"
      if (ticket.status === "Waiting on Customer") {
        newStatus = "Open"
        statusChanged = true
      }
    }

    if (statusChanged) {
      await sql`
        UPDATE tickets SET status = ${newStatus}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `

      // Insert system message for auto-status change
      await sql`
        INSERT INTO ticket_responses (ticket_id, response_type, body, created_by_id, created_by_name, created_by_role)
        VALUES (${id}, 'system', ${"Status automatically changed from \"" + ticket.status + "\" to \"" + newStatus + "\""}, ${user.userId}, ${user.name}, ${user.role})
      `

      await sql`
        INSERT INTO ticket_history (ticket_id, user_id, user_name, action, field_name, old_value, new_value)
        VALUES (${id}, ${user.userId}, ${user.name}, 'update', 'status', ${ticket.status}, ${newStatus})
      `
    } else {
      // Just update the updated_at timestamp
      await sql`UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`
    }

    // Notifications - notify the other party
    if (isCustomer && responseType === "reply") {
      // Customer replied -> notify assigned agent
      if (ticket.assigned_to_id) {
        await createNotification({
          userId: ticket.assigned_to_id,
          type: "ticket",
          title: `New reply on ${ticket.ticket_number}`,
          message: `${user.name} replied on "${ticket.subject}"`,
          entityType: "ticket",
          entityId: id,
        })
      }
    } else if (isEnsuredit && responseType === "reply") {
      // Agent replied -> notify ticket creator
      if (ticket.created_by_id !== user.userId) {
        await createNotification({
          userId: ticket.created_by_id,
          type: "ticket",
          title: `New reply on ${ticket.ticket_number}`,
          message: `${user.name} replied on "${ticket.subject}"`,
          entityType: "ticket",
          entityId: id,
        })
      }
    }

    await logAudit({
      userId: user.userId,
      action: "create",
      entityType: "ticket_response",
      entityId: result[0].id,
      details: { ticket_id: id, response_type: responseType },
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error("Ticket response POST error:", error)
    return NextResponse.json({ error: "Failed to add response" }, { status: 500 })
  }
}
