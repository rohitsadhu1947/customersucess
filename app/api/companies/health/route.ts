import { NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

interface CompanyHealthRow {
  id: string
  name: string
  status: string
  customer_since: string | null
  ensuredit_lead_name: string | null
  total_integrations: number | string
  live_integrations: number | string
  active_integrations: number | string
  total_issues: number | string
  open_issues: number | string
  escalated_issues: number | string
  resolved_issues: number | string
}

interface TrendRow {
  company_id: string
  recent_month: number | string
  older_months: number | string
}

interface CompanyHealth {
  id: string
  name: string
  status: string
  customerSince: string | null
  ensureditLeadName: string | null
  totalIntegrations: number
  liveIntegrations: number
  activeIntegrations: number
  totalIssues: number
  openIssues: number
  escalatedIssues: number
  resolvedIssues: number
  healthScore: number
  resolutionRate: number
  trend: "up" | "down" | "stable"
}

function computeHealthScore(company: CompanyHealthRow): number {
  let healthScore = 100
  const totalIssues = Number(company.total_issues)
  const escalated = Number(company.escalated_issues)
  const resolved = Number(company.resolved_issues)
  const totalIntegrations = Number(company.total_integrations)
  const live = Number(company.live_integrations)

  if (totalIssues > 0) {
    const escalationRate = escalated / totalIssues
    healthScore -= escalationRate * 40
    const resolutionRate = resolved / totalIssues
    healthScore += (resolutionRate - 0.5) * 20
  }
  if (totalIntegrations > 0) {
    const liveRate = live / totalIntegrations
    healthScore += (liveRate - 0.3) * 30
  }
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))
  return healthScore
}

export async function GET() {
  try {
    const user = await verifyAuth()

    // Customer roles: redirect to their own company page
    if (user.role === "Customer" || user.role === "Customer View Only") {
      return NextResponse.json({
        redirect: `/companies/${user.companyId}`,
      })
    }

    // Fetch all active companies with integration and issue stats
    const companies = await sql`
      SELECT
        c.id, c.name, c.status, c.customer_since, c.ensuredit_lead_name,
        COALESCE(ip_stats.total_integrations, 0) as total_integrations,
        COALESCE(ip_stats.live_integrations, 0) as live_integrations,
        COALESCE(ip_stats.active_integrations, 0) as active_integrations,
        COALESCE(issue_stats.total_issues, 0) as total_issues,
        COALESCE(issue_stats.open_issues, 0) as open_issues,
        COALESCE(issue_stats.escalated_issues, 0) as escalated_issues,
        COALESCE(issue_stats.resolved_issues, 0) as resolved_issues
      FROM companies c
      LEFT JOIN (
        SELECT company_id,
          COUNT(*) as total_integrations,
          COUNT(CASE WHEN status = 'Go Live' THEN 1 END) as live_integrations,
          COUNT(CASE WHEN status IN ('Development','Internal Testing','UAT in Progress') THEN 1 END) as active_integrations
        FROM integration_projects
        WHERE (is_deleted = false OR is_deleted IS NULL)
        GROUP BY company_id
      ) ip_stats ON c.id = ip_stats.company_id
      LEFT JOIN (
        SELECT company_id,
          COUNT(*) as total_issues,
          COUNT(CASE WHEN status IN ('Raised','New','Open','In Progress') THEN 1 END) as open_issues,
          COUNT(CASE WHEN status = 'Escalated' THEN 1 END) as escalated_issues,
          COUNT(CASE WHEN status IN ('Resolved','Closed','Completed') THEN 1 END) as resolved_issues
        FROM project_issues
        WHERE (is_deleted = false OR is_deleted IS NULL)
        GROUP BY company_id
      ) issue_stats ON c.id = issue_stats.company_id
      WHERE c.status = 'Active' AND (c.is_deleted = false OR c.is_deleted IS NULL)
      ORDER BY c.name
    ` as CompanyHealthRow[]

    // Fetch 3-month issue trend data
    const trendData = await sql`
      SELECT company_id,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '1 month' THEN 1 END) as recent_month,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '3 months' AND created_at < CURRENT_DATE - INTERVAL '1 month' THEN 1 END) as older_months
      FROM project_issues
      WHERE created_at >= CURRENT_DATE - INTERVAL '3 months'
        AND (is_deleted = false OR is_deleted IS NULL)
      GROUP BY company_id
    ` as TrendRow[]

    // Build trend lookup map
    const trendMap = new Map<string, "up" | "down" | "stable">()
    for (const row of trendData) {
      const recentMonth = Number(row.recent_month)
      const olderMonths = Number(row.older_months)
      const olderAvg = olderMonths / 2

      if (recentMonth > olderAvg) {
        trendMap.set(row.company_id, "up") // worsening
      } else if (recentMonth < olderAvg) {
        trendMap.set(row.company_id, "down") // improving
      } else {
        trendMap.set(row.company_id, "stable")
      }
    }

    // Compute health scores and build response
    const companiesWithHealth: CompanyHealth[] = companies.map((company) => {
      const healthScore = computeHealthScore(company)
      const totalIssues = Number(company.total_issues)
      const resolved = Number(company.resolved_issues)
      const resolutionRate = totalIssues > 0 ? (resolved / totalIssues) * 100 : 0

      return {
        id: company.id,
        name: company.name,
        status: company.status,
        customerSince: company.customer_since,
        ensureditLeadName: company.ensuredit_lead_name,
        totalIntegrations: Number(company.total_integrations),
        liveIntegrations: Number(company.live_integrations),
        activeIntegrations: Number(company.active_integrations),
        totalIssues: Number(company.total_issues),
        openIssues: Number(company.open_issues),
        escalatedIssues: Number(company.escalated_issues),
        resolvedIssues: Number(company.resolved_issues),
        healthScore,
        resolutionRate: Math.round(resolutionRate * 10) / 10,
        trend: trendMap.get(company.id) || "stable",
      }
    })

    // Compute summary
    let healthyCount = 0
    let atRiskCount = 0
    let criticalCount = 0
    let totalScore = 0

    for (const c of companiesWithHealth) {
      totalScore += c.healthScore
      if (c.healthScore >= 80) {
        healthyCount++
      } else if (c.healthScore >= 60) {
        atRiskCount++
      } else {
        criticalCount++
      }
    }

    const totalCompanies = companiesWithHealth.length
    const avgHealthScore = totalCompanies > 0 ? Math.round(totalScore / totalCompanies) : 0

    return NextResponse.json({
      companies: companiesWithHealth,
      summary: {
        totalCompanies,
        healthyCount,
        atRiskCount,
        criticalCount,
        avgHealthScore,
      },
    })
  } catch (error) {
    console.error("Company health GET error:", error)
    return NextResponse.json({ error: "Failed to fetch company health data" }, { status: 500 })
  }
}
