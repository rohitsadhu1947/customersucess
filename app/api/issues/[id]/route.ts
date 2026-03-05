import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    let issues

    if (user.role === "Customer" || user.role === "Customer View Only") {
      issues = await sql`
        SELECT
          ps.*,
          c.name as company_name,
          i.name as insurer_name,
          i.short_name as insurer_short_name,
          u_raised.name as raised_by_user_name,
          u_assigned.name as assigned_to_user_name,
          u_pending.name as pending_with_user_name
        FROM project_issues ps
        LEFT JOIN companies c ON ps.company_id = c.id
        LEFT JOIN insurers i ON ps.insurer_id = i.id
        LEFT JOIN users u_raised ON ps.raised_by_id = u_raised.id
        LEFT JOIN users u_assigned ON ps.assigned_to_id = u_assigned.id
        LEFT JOIN users u_pending ON ps.pending_with_id = u_pending.id
        WHERE ps.id = ${id}
          AND ps.company_id = ${user.companyId}
          AND (ps.is_deleted = false OR ps.is_deleted IS NULL)
      `
    } else {
      issues = await sql`
        SELECT
          ps.*,
          c.name as company_name,
          i.name as insurer_name,
          i.short_name as insurer_short_name,
          u_raised.name as raised_by_user_name,
          u_assigned.name as assigned_to_user_name,
          u_pending.name as pending_with_user_name
        FROM project_issues ps
        LEFT JOIN companies c ON ps.company_id = c.id
        LEFT JOIN insurers i ON ps.insurer_id = i.id
        LEFT JOIN users u_raised ON ps.raised_by_id = u_raised.id
        LEFT JOIN users u_assigned ON ps.assigned_to_id = u_assigned.id
        LEFT JOIN users u_pending ON ps.pending_with_id = u_pending.id
        WHERE ps.id = ${id}
          AND (ps.is_deleted = false OR ps.is_deleted IS NULL)
      `
    }

    if (issues.length === 0) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 })
    }

    return NextResponse.json(issues[0])
  } catch (error) {
    console.error("Issue GET error:", error)
    return NextResponse.json({ error: "Failed to fetch issue" }, { status: 500 })
  }
}
