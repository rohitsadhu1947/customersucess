import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
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

    let tickets
    if (isCustomer) {
      tickets = await sql`
        SELECT t.*
        FROM tickets t
        WHERE t.id = ${id}
          AND t.company_id = ${user.companyId}
          AND (t.is_deleted = false OR t.is_deleted IS NULL)
      `
    } else {
      tickets = await sql`
        SELECT t.*
        FROM tickets t
        WHERE t.id = ${id}
          AND (t.is_deleted = false OR t.is_deleted IS NULL)
      `
    }

    if (tickets.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    return NextResponse.json(tickets[0])
  } catch (error) {
    console.error("Ticket GET error:", error)
    return NextResponse.json({ error: "Failed to fetch ticket" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyAuth()
    const { id } = await params
    const body = await request.json()

    const isCustomer = user.role === "Customer" || user.role === "Customer View Only"
    const isEnsuredit = user.role === "Admin" || user.role === "Ensuredit" || user.role === "Ensuredit Client Lead"

    if (user.role === "Customer View Only") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Fetch current ticket
    let existingTickets
    if (isCustomer) {
      existingTickets = await sql`
        SELECT * FROM tickets WHERE id = ${id}
          AND company_id = ${user.companyId}
          AND created_by_id = ${user.userId}
          AND (is_deleted = false OR is_deleted IS NULL)
      `
    } else {
      existingTickets = await sql`
        SELECT * FROM tickets WHERE id = ${id}
          AND (is_deleted = false OR is_deleted IS NULL)
      `
    }

    if (existingTickets.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const existing = existingTickets[0]

    // Customers can only update tags
    if (isCustomer) {
      if (body.tags) {
        await sql`
          UPDATE tickets SET tags = ${JSON.stringify(body.tags)}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
        `
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ error: "Customers can only update tags" }, { status: 403 })
    }

    // Ensuredit team can update everything
    const updates: string[] = []
    const historyEntries: { field: string; oldVal: string; newVal: string }[] = []

    if (body.status && body.status !== existing.status) {
      historyEntries.push({ field: "status", oldVal: existing.status, newVal: body.status })
    }
    if (body.priority && body.priority !== existing.priority) {
      historyEntries.push({ field: "priority", oldVal: existing.priority, newVal: body.priority })
    }
    if (body.assigned_to_id !== undefined && body.assigned_to_id !== existing.assigned_to_id) {
      historyEntries.push({
        field: "assigned_to",
        oldVal: existing.assigned_to_name || "Unassigned",
        newVal: body.assigned_to_name || "Unassigned",
      })
    }
    if (body.category && body.category !== existing.category) {
      historyEntries.push({ field: "category", oldVal: existing.category, newVal: body.category })
    }
    if (body.assigned_group !== undefined && body.assigned_group !== existing.assigned_group) {
      historyEntries.push({ field: "group", oldVal: existing.assigned_group || "None", newVal: body.assigned_group || "None" })
    }

    // Determine resolved/closed timestamps
    const newStatus = body.status || existing.status
    const resolvedAt = (newStatus === "Resolved" && !existing.resolved_at) ? new Date().toISOString() : (existing.resolved_at || null)
    const closedAt = (newStatus === "Closed" && !existing.closed_at) ? new Date().toISOString() : (existing.closed_at || null)
    const slaBreach = (newStatus === "Resolved" || newStatus === "Closed")
      ? (existing.sla_breach || false)
      : (existing.due_date ? new Date() > new Date(existing.due_date) : false)

    // Perform update
    await sql`
      UPDATE tickets SET
        status = ${newStatus},
        priority = ${body.priority || existing.priority},
        assigned_to_id = ${body.assigned_to_id !== undefined ? body.assigned_to_id : existing.assigned_to_id},
        assigned_to_name = ${body.assigned_to_name !== undefined ? body.assigned_to_name : existing.assigned_to_name},
        assigned_group = ${body.assigned_group !== undefined ? body.assigned_group : existing.assigned_group},
        category = ${body.category || existing.category},
        sub_category = ${body.sub_category !== undefined ? body.sub_category : existing.sub_category},
        tags = ${JSON.stringify(body.tags || existing.tags || [])},
        due_date = ${body.due_date !== undefined ? body.due_date : existing.due_date},
        related_integration_id = ${body.related_integration_id !== undefined ? body.related_integration_id : existing.related_integration_id},
        resolved_at = ${resolvedAt},
        closed_at = ${closedAt},
        sla_breach = ${slaBreach},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `

    // Insert history entries and system responses
    for (const entry of historyEntries) {
      await sql`
        INSERT INTO ticket_history (ticket_id, user_id, user_name, action, field_name, old_value, new_value)
        VALUES (${id}, ${user.userId}, ${user.name}, 'update', ${entry.field}, ${entry.oldVal}, ${entry.newVal})
      `

      let systemMsg = ""
      if (entry.field === "status") {
        systemMsg = `Status changed from "${entry.oldVal}" to "${entry.newVal}" by ${user.name}`
      } else if (entry.field === "assigned_to") {
        systemMsg = `Assigned to ${entry.newVal} by ${user.name}`
      } else if (entry.field === "priority") {
        systemMsg = `Priority changed from "${entry.oldVal}" to "${entry.newVal}" by ${user.name}`
      } else if (entry.field === "category") {
        systemMsg = `Category changed from "${entry.oldVal}" to "${entry.newVal}" by ${user.name}`
      } else if (entry.field === "group") {
        systemMsg = `Group changed from "${entry.oldVal}" to "${entry.newVal}" by ${user.name}`
      }

      if (systemMsg) {
        await sql`
          INSERT INTO ticket_responses (ticket_id, response_type, body, created_by_id, created_by_name, created_by_role)
          VALUES (${id}, 'system', ${systemMsg}, ${user.userId}, ${user.name}, ${user.role})
        `
      }
    }

    // Notifications
    if (body.assigned_to_id && body.assigned_to_id !== existing.assigned_to_id && body.assigned_to_id !== user.userId) {
      await createNotification({
        userId: body.assigned_to_id,
        type: "ticket",
        title: `Ticket Assigned: ${existing.ticket_number}`,
        message: `You have been assigned ticket "${existing.subject}"`,
        entityType: "ticket",
        entityId: id,
      })
    }

    // Notify ticket creator on status changes
    if (body.status && body.status !== existing.status && existing.created_by_id !== user.userId) {
      await createNotification({
        userId: existing.created_by_id,
        type: "ticket",
        title: `Ticket Updated: ${existing.ticket_number}`,
        message: `Status changed to "${body.status}"`,
        entityType: "ticket",
        entityId: id,
      })
    }

    await logAudit({
      userId: user.userId,
      action: "update",
      entityType: "ticket",
      entityId: id,
      details: { changes: historyEntries },
    })

    // Return updated ticket
    const updated = await sql`SELECT * FROM tickets WHERE id = ${id}`
    return NextResponse.json(updated[0])
  } catch (error) {
    console.error("Ticket PUT error:", error)
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 })
  }
}
