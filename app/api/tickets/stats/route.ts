import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth()

    const isCustomer = user.role === "Customer" || user.role === "Customer View Only"

    let byStatus, byPriority, byCategory, slaStats, avgResponseResult, quickCounts
    let weeklyTrend, recentTickets
    let byCompany: any[] = []

    if (isCustomer) {
      quickCounts = await sql`
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('Resolved', 'Closed')) as open,
          COUNT(*) FILTER (WHERE created_by_id = ${user.userId} OR assigned_to_id = ${user.userId}) as my_tickets,
          COUNT(*) FILTER (WHERE due_date < CURRENT_TIMESTAMP AND status NOT IN ('Resolved', 'Closed')) as overdue,
          COUNT(*) FILTER (WHERE assigned_to_id IS NULL AND status NOT IN ('Resolved', 'Closed')) as unassigned
        FROM tickets
        WHERE company_id = ${user.companyId} AND (is_deleted = false OR is_deleted IS NULL)
      `
      byStatus = await sql`
        SELECT status, COUNT(*) as count FROM tickets
        WHERE company_id = ${user.companyId} AND (is_deleted = false OR is_deleted IS NULL)
        GROUP BY status ORDER BY count DESC
      `
      byPriority = await sql`
        SELECT priority, COUNT(*) as count FROM tickets
        WHERE company_id = ${user.companyId} AND (is_deleted = false OR is_deleted IS NULL)
        GROUP BY priority ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 END
      `
      byCategory = await sql`
        SELECT category, COUNT(*) as count FROM tickets
        WHERE company_id = ${user.companyId} AND (is_deleted = false OR is_deleted IS NULL)
        GROUP BY category ORDER BY count DESC
      `
      slaStats = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN sla_breach = true OR sla_response_breach = true THEN 1 END) as breached
        FROM tickets
        WHERE company_id = ${user.companyId} AND (is_deleted = false OR is_deleted IS NULL)
          AND status NOT IN ('Closed')
      `
      avgResponseResult = await sql`
        SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600)::numeric(10,1) as avg_hours
        FROM tickets
        WHERE company_id = ${user.companyId} AND first_response_at IS NOT NULL
          AND (is_deleted = false OR is_deleted IS NULL)
      `
      weeklyTrend = await sql`
        SELECT date_trunc('week', created_at)::date as week, COUNT(*) as count
        FROM tickets
        WHERE company_id = ${user.companyId}
          AND created_at >= NOW() - INTERVAL '8 weeks'
          AND (is_deleted = false OR is_deleted IS NULL)
        GROUP BY week ORDER BY week ASC
      `
      recentTickets = await sql`
        SELECT id, ticket_number, subject, priority, status, company_name,
               assigned_to_name, created_by_name, created_at, due_date
        FROM tickets
        WHERE company_id = ${user.companyId}
          AND status NOT IN ('Resolved', 'Closed')
          AND (is_deleted = false OR is_deleted IS NULL)
        ORDER BY created_at DESC LIMIT 5
      `
    } else {
      quickCounts = await sql`
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('Resolved', 'Closed')) as open,
          COUNT(*) FILTER (WHERE created_by_id = ${user.userId} OR assigned_to_id = ${user.userId}) as my_tickets,
          COUNT(*) FILTER (WHERE due_date < CURRENT_TIMESTAMP AND status NOT IN ('Resolved', 'Closed')) as overdue,
          COUNT(*) FILTER (WHERE assigned_to_id IS NULL AND status NOT IN ('Resolved', 'Closed')) as unassigned
        FROM tickets
        WHERE (is_deleted = false OR is_deleted IS NULL)
      `
      byStatus = await sql`
        SELECT status, COUNT(*) as count FROM tickets
        WHERE (is_deleted = false OR is_deleted IS NULL)
        GROUP BY status ORDER BY count DESC
      `
      byPriority = await sql`
        SELECT priority, COUNT(*) as count FROM tickets
        WHERE (is_deleted = false OR is_deleted IS NULL)
        GROUP BY priority ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 END
      `
      byCategory = await sql`
        SELECT category, COUNT(*) as count FROM tickets
        WHERE (is_deleted = false OR is_deleted IS NULL)
        GROUP BY category ORDER BY count DESC
      `
      slaStats = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN sla_breach = true OR sla_response_breach = true THEN 1 END) as breached
        FROM tickets
        WHERE (is_deleted = false OR is_deleted IS NULL)
          AND status NOT IN ('Closed')
      `
      avgResponseResult = await sql`
        SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600)::numeric(10,1) as avg_hours
        FROM tickets
        WHERE first_response_at IS NOT NULL AND (is_deleted = false OR is_deleted IS NULL)
      `
      weeklyTrend = await sql`
        SELECT date_trunc('week', created_at)::date as week, COUNT(*) as count
        FROM tickets
        WHERE created_at >= NOW() - INTERVAL '8 weeks'
          AND (is_deleted = false OR is_deleted IS NULL)
        GROUP BY week ORDER BY week ASC
      `
      recentTickets = await sql`
        SELECT id, ticket_number, subject, priority, status, company_name,
               assigned_to_name, created_by_name, created_at, due_date
        FROM tickets
        WHERE status NOT IN ('Resolved', 'Closed')
          AND (is_deleted = false OR is_deleted IS NULL)
        ORDER BY created_at DESC LIMIT 5
      `
      byCompany = await sql`
        SELECT c.name as company_name, COUNT(*) as count
        FROM tickets t JOIN companies c ON t.company_id = c.id
        WHERE t.status NOT IN ('Resolved', 'Closed')
          AND (t.is_deleted = false OR t.is_deleted IS NULL)
        GROUP BY c.name ORDER BY count DESC LIMIT 10
      `
    }

    const total = Number(slaStats[0]?.total || 0)
    const breached = Number(slaStats[0]?.breached || 0)

    return NextResponse.json({
      open: Number(quickCounts[0]?.open || 0),
      myTickets: Number(quickCounts[0]?.my_tickets || 0),
      overdue: Number(quickCounts[0]?.overdue || 0),
      unassigned: Number(quickCounts[0]?.unassigned || 0),
      byStatus,
      byPriority,
      byCategory,
      slaCompliance: {
        total,
        breached,
        rate: total > 0 ? Math.round(((total - breached) / total) * 1000) / 10 : 100,
      },
      avgResponseTime: Number(avgResponseResult[0]?.avg_hours || 0),
      recentActivity: byStatus.reduce((sum: number, s: any) => sum + Number(s.count), 0),
      byCompany,
      weeklyTrend,
      recentTickets,
    })
  } catch (error) {
    console.error("Ticket stats GET error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
