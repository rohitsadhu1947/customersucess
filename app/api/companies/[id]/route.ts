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

    // Role-based access
    if ((user.role === "Customer" || user.role === "Customer View Only") && user.companyId !== id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get company details
    const [company] = await sql`
      SELECT
        c.*,
        COALESCE(u.user_count, 0) as user_count,
        COALESCE(u.active_user_count, 0) as active_user_count
      FROM companies c
      LEFT JOIN (
        SELECT
          company_id,
          COUNT(*) as user_count,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_user_count
        FROM users
        WHERE company_id IS NOT NULL
        GROUP BY company_id
      ) u ON c.id = u.company_id
      WHERE c.id = ${id}
        AND (c.is_deleted = false OR c.is_deleted IS NULL)
    `

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Get integration projects for this company
    const integrations = await sql`
      SELECT
        ip.*,
        i.name as insurer_name,
        p.name as product_name,
        sp.name as sub_product_name
      FROM integration_projects ip
      LEFT JOIN insurers i ON ip.insurer_id = i.id
      LEFT JOIN products p ON ip.product_id = p.id
      LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
      WHERE ip.company_id = ${id}
        AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
      ORDER BY ip.updated_at DESC
    `

    // Get issues for this company
    const issues = await sql`
      SELECT
        ps.*,
        i.name as insurer_name,
        u_assigned.name as assigned_to_user_name
      FROM project_issues ps
      LEFT JOIN insurers i ON ps.insurer_id = i.id
      LEFT JOIN users u_assigned ON ps.assigned_to_id = u_assigned.id
      WHERE ps.company_id = ${id}
        AND (ps.is_deleted = false OR ps.is_deleted IS NULL)
      ORDER BY ps.updated_at DESC
      LIMIT 20
    `

    // Get issue stats
    const [issueStats] = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status IN ('Raised', 'New', 'Open') THEN 1 END) as open_count,
        COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'Escalated' THEN 1 END) as escalated_count,
        COUNT(CASE WHEN status IN ('Resolved', 'Closed', 'Completed') THEN 1 END) as resolved_count
      FROM project_issues
      WHERE company_id = ${id}
        AND (is_deleted = false OR is_deleted IS NULL)
    `

    // Get integration stats
    const [integrationStats] = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Go Live' THEN 1 END) as live_count,
        COUNT(CASE WHEN status IN ('Development', 'Internal Testing', 'UAT in Progress') THEN 1 END) as active_count
      FROM integration_projects
      WHERE company_id = ${id}
        AND (is_deleted = false OR is_deleted IS NULL)
    `

    // Compute health score (0-100) — unified algorithm
    const totalIssues = Number(issueStats.total) || 0
    const escalated = Number(issueStats.escalated_count) || 0
    const resolved = Number(issueStats.resolved_count) || 0
    const totalIntegrations = Number(integrationStats.total) || 0
    const liveIntegrations = Number(integrationStats.live_count) || 0
    const activeIntegrations = Number(integrationStats.active_count) || 0

    let healthScore = 100
    if (totalIssues > 0) {
      const escalationRate = escalated / totalIssues
      healthScore -= escalationRate * 40
      const resolutionRate = resolved / totalIssues
      healthScore += resolutionRate * 10
    }
    if (totalIntegrations > 0) {
      const progressRate = (liveIntegrations + activeIntegrations * 0.5) / totalIntegrations
      healthScore += progressRate * 15 - 5
    }
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))

    return NextResponse.json({
      company,
      integrations,
      issues,
      stats: {
        issues: {
          total: Number(issueStats.total) || 0,
          open: Number(issueStats.open_count) || 0,
          inProgress: Number(issueStats.in_progress_count) || 0,
          escalated: Number(issueStats.escalated_count) || 0,
          resolved: Number(issueStats.resolved_count) || 0,
        },
        integrations: {
          total: Number(integrationStats.total) || 0,
          live: Number(integrationStats.live_count) || 0,
          active: Number(integrationStats.active_count) || 0,
        },
        healthScore,
      },
    })
  } catch (error) {
    console.error("Company detail GET error:", error)
    return NextResponse.json({ error: "Failed to fetch company details" }, { status: 500 })
  }
}
