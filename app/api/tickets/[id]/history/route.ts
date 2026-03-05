import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

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

    const history = await sql`
      SELECT * FROM ticket_history
      WHERE ticket_id = ${id}
      ORDER BY created_at DESC
    `

    return NextResponse.json(history)
  } catch (error) {
    console.error("Ticket history GET error:", error)
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
  }
}
