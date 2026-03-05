import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { validateBody, createTicketSchema } from "@/lib/validations"
import { logAudit } from "@/lib/audit"
import { getPaginationParams, paginatedResponse } from "@/lib/pagination"
import { calculateDueDate } from "@/lib/sla"
import { notifyEnsureditTeam, createNotification } from "@/lib/notifications"

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth()
    const { searchParams } = new URL(request.url)

    const isCustomer = user.role === "Customer" || user.role === "Customer View Only"
    const status = searchParams.get("status")
    const priority = searchParams.get("priority")
    const category = searchParams.get("category")
    const companyId = searchParams.get("company_id")
    const assignedToId = searchParams.get("assigned_to_id")
    const search = searchParams.get("search")
    const myTickets = searchParams.get("my_tickets") === "true"
    const unassigned = searchParams.get("unassigned") === "true"
    const overdue = searchParams.get("overdue") === "true"

    const paginationParams = getPaginationParams(request)
    const effectiveCompanyId = isCustomer ? user.companyId : companyId

    // Build WHERE conditions
    let whereClause = `WHERE (t.is_deleted = false OR t.is_deleted IS NULL)`

    if (effectiveCompanyId) {
      whereClause += ` AND t.company_id = '${effectiveCompanyId}'`
    }
    if (status) {
      whereClause += ` AND t.status = '${status}'`
    }
    if (priority) {
      whereClause += ` AND t.priority = '${priority}'`
    }
    if (category) {
      whereClause += ` AND t.category = '${category}'`
    }
    if (assignedToId) {
      whereClause += ` AND t.assigned_to_id = '${assignedToId}'`
    }
    if (myTickets) {
      whereClause += ` AND (t.assigned_to_id = '${user.userId}' OR t.created_by_id = '${user.userId}')`
    }
    if (unassigned) {
      whereClause += ` AND t.assigned_to_id IS NULL`
    }
    if (overdue) {
      whereClause += ` AND t.due_date < CURRENT_TIMESTAMP AND t.status NOT IN ('Resolved', 'Closed')`
    }
    if (search) {
      const searchLower = search.toLowerCase()
      whereClause += ` AND (LOWER(t.ticket_number) LIKE '%${searchLower}%' OR LOWER(t.subject) LIKE '%${searchLower}%' OR LOWER(t.description) LIKE '%${searchLower}%')`
    }

    // Use parameterized queries instead of string interpolation for safety
    // Since sql tagged templates don't support dynamic WHERE easily, we use conditional queries
    let tickets
    let countResult

    if (isCustomer) {
      if (search) {
        const searchPattern = `%${search.toLowerCase()}%`
        countResult = await sql`
          SELECT COUNT(*) as total FROM tickets t
          WHERE (t.is_deleted = false OR t.is_deleted IS NULL)
            AND t.company_id = ${user.companyId}
            ${status ? sql`AND t.status = ${status}` : sql``}
            ${priority ? sql`AND t.priority = ${priority}` : sql``}
            ${category ? sql`AND t.category = ${category}` : sql``}
            ${myTickets ? sql`AND (t.assigned_to_id = ${user.userId} OR t.created_by_id = ${user.userId})` : sql``}
            ${unassigned ? sql`AND t.assigned_to_id IS NULL` : sql``}
            ${overdue ? sql`AND t.due_date < CURRENT_TIMESTAMP AND t.status NOT IN ('Resolved', 'Closed')` : sql``}
            AND (LOWER(t.ticket_number) LIKE ${searchPattern} OR LOWER(t.subject) LIKE ${searchPattern} OR LOWER(t.description) LIKE ${searchPattern})
        `
        tickets = await sql`
          SELECT t.*
          FROM tickets t
          WHERE (t.is_deleted = false OR t.is_deleted IS NULL)
            AND t.company_id = ${user.companyId}
            ${status ? sql`AND t.status = ${status}` : sql``}
            ${priority ? sql`AND t.priority = ${priority}` : sql``}
            ${category ? sql`AND t.category = ${category}` : sql``}
            ${myTickets ? sql`AND (t.assigned_to_id = ${user.userId} OR t.created_by_id = ${user.userId})` : sql``}
            ${unassigned ? sql`AND t.assigned_to_id IS NULL` : sql``}
            ${overdue ? sql`AND t.due_date < CURRENT_TIMESTAMP AND t.status NOT IN ('Resolved', 'Closed')` : sql``}
            AND (LOWER(t.ticket_number) LIKE ${searchPattern} OR LOWER(t.subject) LIKE ${searchPattern} OR LOWER(t.description) LIKE ${searchPattern})
          ORDER BY t.updated_at DESC
          LIMIT ${paginationParams.limit} OFFSET ${paginationParams.offset}
        `
      } else {
        countResult = await sql`
          SELECT COUNT(*) as total FROM tickets t
          WHERE (t.is_deleted = false OR t.is_deleted IS NULL)
            AND t.company_id = ${user.companyId}
            ${status ? sql`AND t.status = ${status}` : sql``}
            ${priority ? sql`AND t.priority = ${priority}` : sql``}
            ${category ? sql`AND t.category = ${category}` : sql``}
            ${myTickets ? sql`AND (t.assigned_to_id = ${user.userId} OR t.created_by_id = ${user.userId})` : sql``}
            ${unassigned ? sql`AND t.assigned_to_id IS NULL` : sql``}
            ${overdue ? sql`AND t.due_date < CURRENT_TIMESTAMP AND t.status NOT IN ('Resolved', 'Closed')` : sql``}
        `
        tickets = await sql`
          SELECT t.*
          FROM tickets t
          WHERE (t.is_deleted = false OR t.is_deleted IS NULL)
            AND t.company_id = ${user.companyId}
            ${status ? sql`AND t.status = ${status}` : sql``}
            ${priority ? sql`AND t.priority = ${priority}` : sql``}
            ${category ? sql`AND t.category = ${category}` : sql``}
            ${myTickets ? sql`AND (t.assigned_to_id = ${user.userId} OR t.created_by_id = ${user.userId})` : sql``}
            ${unassigned ? sql`AND t.assigned_to_id IS NULL` : sql``}
            ${overdue ? sql`AND t.due_date < CURRENT_TIMESTAMP AND t.status NOT IN ('Resolved', 'Closed')` : sql``}
          ORDER BY t.updated_at DESC
          LIMIT ${paginationParams.limit} OFFSET ${paginationParams.offset}
        `
      }
    } else {
      if (search) {
        const searchPattern = `%${search.toLowerCase()}%`
        countResult = await sql`
          SELECT COUNT(*) as total FROM tickets t
          WHERE (t.is_deleted = false OR t.is_deleted IS NULL)
            ${effectiveCompanyId ? sql`AND t.company_id = ${effectiveCompanyId}` : sql``}
            ${status ? sql`AND t.status = ${status}` : sql``}
            ${priority ? sql`AND t.priority = ${priority}` : sql``}
            ${category ? sql`AND t.category = ${category}` : sql``}
            ${assignedToId ? sql`AND t.assigned_to_id = ${assignedToId}` : sql``}
            ${myTickets ? sql`AND (t.assigned_to_id = ${user.userId} OR t.created_by_id = ${user.userId})` : sql``}
            ${unassigned ? sql`AND t.assigned_to_id IS NULL` : sql``}
            ${overdue ? sql`AND t.due_date < CURRENT_TIMESTAMP AND t.status NOT IN ('Resolved', 'Closed')` : sql``}
            AND (LOWER(t.ticket_number) LIKE ${searchPattern} OR LOWER(t.subject) LIKE ${searchPattern} OR LOWER(t.description) LIKE ${searchPattern})
        `
        tickets = await sql`
          SELECT t.*
          FROM tickets t
          WHERE (t.is_deleted = false OR t.is_deleted IS NULL)
            ${effectiveCompanyId ? sql`AND t.company_id = ${effectiveCompanyId}` : sql``}
            ${status ? sql`AND t.status = ${status}` : sql``}
            ${priority ? sql`AND t.priority = ${priority}` : sql``}
            ${category ? sql`AND t.category = ${category}` : sql``}
            ${assignedToId ? sql`AND t.assigned_to_id = ${assignedToId}` : sql``}
            ${myTickets ? sql`AND (t.assigned_to_id = ${user.userId} OR t.created_by_id = ${user.userId})` : sql``}
            ${unassigned ? sql`AND t.assigned_to_id IS NULL` : sql``}
            ${overdue ? sql`AND t.due_date < CURRENT_TIMESTAMP AND t.status NOT IN ('Resolved', 'Closed')` : sql``}
            AND (LOWER(t.ticket_number) LIKE ${searchPattern} OR LOWER(t.subject) LIKE ${searchPattern} OR LOWER(t.description) LIKE ${searchPattern})
          ORDER BY t.updated_at DESC
          LIMIT ${paginationParams.limit} OFFSET ${paginationParams.offset}
        `
      } else {
        countResult = await sql`
          SELECT COUNT(*) as total FROM tickets t
          WHERE (t.is_deleted = false OR t.is_deleted IS NULL)
            ${effectiveCompanyId ? sql`AND t.company_id = ${effectiveCompanyId}` : sql``}
            ${status ? sql`AND t.status = ${status}` : sql``}
            ${priority ? sql`AND t.priority = ${priority}` : sql``}
            ${category ? sql`AND t.category = ${category}` : sql``}
            ${assignedToId ? sql`AND t.assigned_to_id = ${assignedToId}` : sql``}
            ${myTickets ? sql`AND (t.assigned_to_id = ${user.userId} OR t.created_by_id = ${user.userId})` : sql``}
            ${unassigned ? sql`AND t.assigned_to_id IS NULL` : sql``}
            ${overdue ? sql`AND t.due_date < CURRENT_TIMESTAMP AND t.status NOT IN ('Resolved', 'Closed')` : sql``}
        `
        tickets = await sql`
          SELECT t.*
          FROM tickets t
          WHERE (t.is_deleted = false OR t.is_deleted IS NULL)
            ${effectiveCompanyId ? sql`AND t.company_id = ${effectiveCompanyId}` : sql``}
            ${status ? sql`AND t.status = ${status}` : sql``}
            ${priority ? sql`AND t.priority = ${priority}` : sql``}
            ${category ? sql`AND t.category = ${category}` : sql``}
            ${assignedToId ? sql`AND t.assigned_to_id = ${assignedToId}` : sql``}
            ${myTickets ? sql`AND (t.assigned_to_id = ${user.userId} OR t.created_by_id = ${user.userId})` : sql``}
            ${unassigned ? sql`AND t.assigned_to_id IS NULL` : sql``}
            ${overdue ? sql`AND t.due_date < CURRENT_TIMESTAMP AND t.status NOT IN ('Resolved', 'Closed')` : sql``}
          ORDER BY t.updated_at DESC
          LIMIT ${paginationParams.limit} OFFSET ${paginationParams.offset}
        `
      }
    }

    const total = Number(countResult[0]?.total || 0)
    return NextResponse.json(paginatedResponse(tickets, total, paginationParams))
  } catch (error) {
    console.error("Tickets GET error:", error)
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth()

    // Check role permissions
    const allowedRoles = ["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"]
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const isCustomer = user.role === "Customer" || user.role === "Customer View Only"

    // Force company_id for customers
    if (isCustomer) {
      body.company_id = user.companyId
    }

    const validation = validateBody(createTicketSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const data = validation.data

    // Get company name
    const companies = await sql`SELECT name FROM companies WHERE id = ${data.company_id}`
    const companyName = companies[0]?.name || ""

    // Calculate due date based on priority
    const dueDate = calculateDueDate(data.priority || "Medium")

    // Generate ticket number first
    const seqResult = await sql`
      SELECT 'TKT-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMM') || '-' || LPAD(nextval('ticket_seq')::text, 5, '0') as ticket_number
    `
    const ticketNumber = seqResult[0].ticket_number

    // Insert ticket
    const tagsJson = JSON.stringify(data.tags || [])
    const dueDateStr = dueDate.toISOString()

    const result = await sql`
      INSERT INTO tickets (
        ticket_number, subject, description, category, sub_category,
        priority, status, source, company_id, company_name,
        created_by_id, created_by_name,
        assigned_to_id, assigned_to_name, assigned_group,
        related_integration_id, tags, due_date
      ) VALUES (
        ${ticketNumber},
        ${data.subject}, ${data.description}, ${data.category}, ${data.sub_category || null},
        ${data.priority || "Medium"}, 'New', 'web', ${data.company_id}, ${companyName},
        ${user.userId}, ${user.name},
        ${data.assigned_to_id || null}, ${data.assigned_to_name || null}, ${data.assigned_group || null},
        ${data.related_integration_id || null}, ${tagsJson}::jsonb, ${dueDateStr}
      )
      RETURNING *
    `

    const ticket = result[0]

    // Create system response
    await sql`
      INSERT INTO ticket_responses (ticket_id, response_type, body, created_by_id, created_by_name, created_by_role)
      VALUES (${ticket.id}, 'system', ${"Ticket created by " + user.name}, ${user.userId}, ${user.name}, ${user.role})
    `

    // Create history entry
    await sql`
      INSERT INTO ticket_history (ticket_id, user_id, user_name, action)
      VALUES (${ticket.id}, ${user.userId}, ${user.name}, 'create')
    `

    // Notify Ensuredit team (don't notify the creator if they're Ensuredit)
    await notifyEnsureditTeam(
      `New Ticket: ${ticket.ticket_number}`,
      `${user.name} created ticket "${data.subject}" (${data.priority} - ${data.category})`,
      "ticket",
      ticket.id,
      isCustomer ? undefined : user.userId,
    )

    // If assigned, notify the assignee
    if (data.assigned_to_id && data.assigned_to_id !== user.userId) {
      await createNotification({
        userId: data.assigned_to_id,
        type: "ticket",
        title: `Ticket Assigned: ${ticket.ticket_number}`,
        message: `You have been assigned ticket "${data.subject}"`,
        entityType: "ticket",
        entityId: ticket.id,
      })
    }

    await logAudit({
      userId: user.userId,
      action: "create",
      entityType: "ticket",
      entityId: ticket.id,
      details: { ticket_number: ticket.ticket_number, subject: data.subject, category: data.category, priority: data.priority },
    })

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error("Tickets POST error:", error)
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 })
  }
}
