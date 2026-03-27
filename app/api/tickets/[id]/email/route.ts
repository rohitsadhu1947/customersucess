import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"
import { sendTicketEmail } from "@/lib/email/send"

// GET - List all emails for a ticket
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    // Customers cannot see email correspondence
    if (user.role === "Customer" || user.role === "Customer View Only") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const emails = await sql`
      SELECT
        em.*,
        et.name as template_name,
        et.category as template_category
      FROM email_messages em
      LEFT JOIN email_templates et ON em.template_id = et.id
      WHERE em.ticket_id = ${id} AND em.is_deleted = false
      ORDER BY em.created_at ASC
    `

    return NextResponse.json(emails)
  } catch (error) {
    console.error("Ticket emails GET error:", error)
    return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 })
  }
}

// POST - Send an email from a ticket
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    // Only Ensuredit roles can send emails
    if (!["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user.role)) {
      return NextResponse.json({ error: "Only Ensuredit team can send emails" }, { status: 403 })
    }

    // Get ticket details for context
    const [ticket] = await sql`
      SELECT t.*, c.name as company_name_resolved
      FROM tickets t
      LEFT JOIN companies c ON t.company_id = c.id
      WHERE t.id = ${id} AND t.is_deleted = false
    `

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const body = await request.json()
    const { to_addresses, cc_addresses, subject, body_text, body_html, template_id } = body

    if (!to_addresses || to_addresses.length === 0) {
      return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 })
    }
    if (!subject || !body_text) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 })
    }

    // Rate limiting: max 10 emails per ticket per hour
    const [rateCheck] = await sql`
      SELECT COUNT(*) as count FROM email_messages
      WHERE ticket_id = ${id}
        AND direction = 'outbound'
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
    `
    if (Number(rateCheck.count) >= 10) {
      return NextResponse.json({ error: "Rate limit exceeded. Max 10 emails per ticket per hour." }, { status: 429 })
    }

    // Determine sender email — use user's email from the verified domain
    const fromDomain = process.env.EMAIL_FROM_DOMAIN || "ensuredit.com"
    const [userData] = await sql`SELECT email FROM users WHERE id = ${user.userId}`
    const senderEmail = userData?.email || `${user.name.toLowerCase().replace(/\s+/g, ".")}@${fromDomain}`

    const result = await sendTicketEmail({
      ticketId: id,
      ticketNumber: ticket.ticket_number,
      toAddresses: to_addresses,
      ccAddresses: cc_addresses,
      subject,
      bodyText: body_text,
      bodyHtml: body_html,
      templateId: template_id,
      sentById: user.userId,
      sentByName: user.name,
      sentByEmail: senderEmail,
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        emailMessageId: result.emailMessageId,
        ticketResponseId: result.ticketResponseId,
      }, { status: 201 })
    } else {
      return NextResponse.json({
        error: result.error || "Failed to send email",
        emailMessageId: result.emailMessageId,
      }, { status: 500 })
    }
  } catch (error) {
    console.error("Ticket email POST error:", error)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
