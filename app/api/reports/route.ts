import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth()

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get("type") || "issues-summary"
    const dateFrom = searchParams.get("from")
    const dateTo = searchParams.get("to")
    const companyId = searchParams.get("company_id")

    const isCustomer = user.role === "Customer" || user.role === "Customer View Only"
    const isEnsuredit = user.role === "Admin" || user.role === "Ensuredit" || user.role === "Ensuredit Client Lead"
    const effectiveCompanyId = isCustomer ? user.companyId : companyId

    switch (reportType) {
      case "issues-summary": {
        let rows
        if (effectiveCompanyId) {
          rows = await sql`
            SELECT
              issue_category,
              status,
              priority,
              COUNT(*) as count,
              COUNT(CASE WHEN status IN ('Resolved', 'Closed', 'Completed') THEN 1 END) as resolved_count,
              AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, CURRENT_TIMESTAMP) - created_at)) / 86400)::numeric(10,1) as avg_resolution_days
            FROM project_issues
            WHERE company_id = ${effectiveCompanyId}
              AND (is_deleted = false OR is_deleted IS NULL)
              ${dateFrom ? sql`AND created_at >= ${dateFrom}` : sql``}
              ${dateTo ? sql`AND created_at <= ${dateTo}::date + INTERVAL '1 day'` : sql``}
            GROUP BY issue_category, status, priority
            ORDER BY count DESC
          `
        } else {
          rows = await sql`
            SELECT
              issue_category,
              status,
              priority,
              COUNT(*) as count,
              COUNT(CASE WHEN status IN ('Resolved', 'Closed', 'Completed') THEN 1 END) as resolved_count,
              AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, CURRENT_TIMESTAMP) - created_at)) / 86400)::numeric(10,1) as avg_resolution_days
            FROM project_issues
            WHERE (is_deleted = false OR is_deleted IS NULL)
              ${dateFrom ? sql`AND created_at >= ${dateFrom}` : sql``}
              ${dateTo ? sql`AND created_at <= ${dateTo}::date + INTERVAL '1 day'` : sql``}
            GROUP BY issue_category, status, priority
            ORDER BY count DESC
          `
        }

        const totalIssues = rows.reduce((sum: number, r: any) => sum + Number(r.count), 0)
        const openIssues = rows
          .filter((r: any) => !["Resolved", "Closed", "Completed"].includes(r.status))
          .reduce((sum: number, r: any) => sum + Number(r.count), 0)
        const resolvedCount = rows.reduce((sum: number, r: any) => sum + Number(r.resolved_count), 0)
        const resolutionRate = totalIssues > 0 ? Math.round((resolvedCount / totalIssues) * 1000) / 10 : 0
        const allAvgDays = rows.filter((r: any) => r.avg_resolution_days !== null)
        const avgResolutionDays =
          allAvgDays.length > 0
            ? Math.round(
                (allAvgDays.reduce((sum: number, r: any) => sum + Number(r.avg_resolution_days), 0) / allAvgDays.length) * 10
              ) / 10
            : 0

        const summary = { totalIssues, openIssues, resolutionRate, avgResolutionDays }

        // Build stacked bar data grouped by category
        const categoryMap: Record<string, Record<string, number>> = {}
        for (const row of rows) {
          const cat = row.issue_category || "Unknown"
          if (!categoryMap[cat]) categoryMap[cat] = {}
          categoryMap[cat][row.status] = (categoryMap[cat][row.status] || 0) + Number(row.count)
        }
        const chartData = Object.entries(categoryMap).map(([category, statuses]) => ({
          category,
          ...statuses,
        }))

        return NextResponse.json({ type: reportType, data: rows, summary, chartData })
      }

      case "issues-by-company": {
        if (isCustomer) {
          return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
        }
        const rows = await sql`
          SELECT
            c.name as company_name,
            c.id as company_id,
            COUNT(ps.id) as total_issues,
            COUNT(CASE WHEN ps.status IN ('Raised', 'New', 'Open') THEN 1 END) as open_issues,
            COUNT(CASE WHEN ps.status = 'Escalated' THEN 1 END) as escalated_issues,
            COUNT(CASE WHEN ps.status IN ('Resolved', 'Closed', 'Completed') THEN 1 END) as resolved_issues,
            CASE WHEN COUNT(ps.id) = 0 THEN 0
              ELSE ROUND((COUNT(CASE WHEN ps.status IN ('Resolved', 'Closed', 'Completed') THEN 1 END) * 100.0 / COUNT(ps.id))::numeric, 1)
            END as resolution_rate
          FROM companies c
          LEFT JOIN project_issues ps ON c.id = ps.company_id
            AND (ps.is_deleted = false OR ps.is_deleted IS NULL)
            ${dateFrom ? sql`AND ps.created_at >= ${dateFrom}` : sql``}
            ${dateTo ? sql`AND ps.created_at <= ${dateTo}::date + INTERVAL '1 day'` : sql``}
          WHERE (c.is_deleted = false OR c.is_deleted IS NULL)
          GROUP BY c.id, c.name
          ORDER BY total_issues DESC
        `

        const totalCompanies = rows.length
        const avgResolutionRate =
          totalCompanies > 0
            ? Math.round(
                (rows.reduce((sum: number, r: any) => sum + Number(r.resolution_rate), 0) / totalCompanies) * 10
              ) / 10
            : 0

        const summary = { totalCompanies, avgResolutionRate }

        const chartData = rows.map((r: any) => ({
          name: r.company_name,
          total: Number(r.total_issues),
          resolved: Number(r.resolved_issues),
          escalated: Number(r.escalated_issues),
        }))

        return NextResponse.json({ type: reportType, data: rows, summary, chartData })
      }

      case "integrations-status": {
        let rows
        if (effectiveCompanyId) {
          rows = await sql`
            SELECT
              ip.status,
              COUNT(*) as count,
              i.name as insurer_name
            FROM integration_projects ip
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            WHERE ip.company_id = ${effectiveCompanyId}
              AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
            GROUP BY ip.status, i.name
            ORDER BY count DESC
          `
        } else {
          rows = await sql`
            SELECT
              ip.status,
              COUNT(*) as count,
              i.name as insurer_name
            FROM integration_projects ip
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            WHERE (ip.is_deleted = false OR ip.is_deleted IS NULL)
            GROUP BY ip.status, i.name
            ORDER BY count DESC
          `
        }

        const totalIntegrations = rows.reduce((sum: number, r: any) => sum + Number(r.count), 0)
        const goLiveCount = rows
          .filter((r: any) => r.status === "Go Live")
          .reduce((sum: number, r: any) => sum + Number(r.count), 0)
        const activeCount = rows
          .filter((r: any) => !["Go Live", "Not Started"].includes(r.status))
          .reduce((sum: number, r: any) => sum + Number(r.count), 0)

        const summary = { totalIntegrations, goLiveCount, activeCount }

        // Build pie chart segments grouped by status
        const statusMap: Record<string, number> = {}
        for (const row of rows) {
          const s = row.status || "Unknown"
          statusMap[s] = (statusMap[s] || 0) + Number(row.count)
        }
        const STATUS_COLORS: Record<string, string> = {
          "Not Started": "#94A3B8",
          "Development": "#3B82F6",
          "Internal Testing": "#8B5CF6",
          "UAT in Progress": "#F59E0B",
          "Go Live": "#10B981",
        }
        const chartData = Object.entries(statusMap).map(([name, value]) => ({
          name,
          value,
          fill: STATUS_COLORS[name] || "#6B7280",
        }))

        return NextResponse.json({ type: reportType, data: rows, summary, chartData })
      }

      case "resolution-time": {
        let rows
        if (effectiveCompanyId) {
          rows = await sql`
            SELECT
              issue_category,
              COUNT(*) as total,
              COUNT(CASE WHEN status IN ('Resolved', 'Closed', 'Completed') THEN 1 END) as resolved,
              AVG(CASE WHEN resolved_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400
                ELSE NULL END)::numeric(10,1) as avg_days,
              MIN(CASE WHEN resolved_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400
                ELSE NULL END)::numeric(10,1) as min_days,
              MAX(CASE WHEN resolved_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400
                ELSE NULL END)::numeric(10,1) as max_days
            FROM project_issues
            WHERE company_id = ${effectiveCompanyId}
              AND (is_deleted = false OR is_deleted IS NULL)
              ${dateFrom ? sql`AND created_at >= ${dateFrom}` : sql``}
              ${dateTo ? sql`AND created_at <= ${dateTo}::date + INTERVAL '1 day'` : sql``}
            GROUP BY issue_category
            ORDER BY total DESC
          `
        } else {
          rows = await sql`
            SELECT
              issue_category,
              COUNT(*) as total,
              COUNT(CASE WHEN status IN ('Resolved', 'Closed', 'Completed') THEN 1 END) as resolved,
              AVG(CASE WHEN resolved_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400
                ELSE NULL END)::numeric(10,1) as avg_days,
              MIN(CASE WHEN resolved_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400
                ELSE NULL END)::numeric(10,1) as min_days,
              MAX(CASE WHEN resolved_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400
                ELSE NULL END)::numeric(10,1) as max_days
            FROM project_issues
            WHERE (is_deleted = false OR is_deleted IS NULL)
              ${dateFrom ? sql`AND created_at >= ${dateFrom}` : sql``}
              ${dateTo ? sql`AND created_at <= ${dateTo}::date + INTERVAL '1 day'` : sql``}
            GROUP BY issue_category
            ORDER BY total DESC
          `
        }

        const withAvg = rows.filter((r: any) => r.avg_days !== null)
        const avgDays =
          withAvg.length > 0
            ? Math.round(
                (withAvg.reduce((sum: number, r: any) => sum + Number(r.avg_days), 0) / withAvg.length) * 10
              ) / 10
            : 0
        const withMin = rows.filter((r: any) => r.min_days !== null)
        const minDays =
          withMin.length > 0
            ? Math.round(Math.min(...withMin.map((r: any) => Number(r.min_days))) * 10) / 10
            : 0
        const withMax = rows.filter((r: any) => r.max_days !== null)
        const maxDays =
          withMax.length > 0
            ? Math.round(Math.max(...withMax.map((r: any) => Number(r.max_days))) * 10) / 10
            : 0

        const summary = { avgDays, minDays, maxDays }

        const chartData = rows.map((r: any) => ({
          category: r.issue_category || "Unknown",
          avgDays: Number(r.avg_days) || 0,
          minDays: Number(r.min_days) || 0,
          maxDays: Number(r.max_days) || 0,
        }))

        return NextResponse.json({ type: reportType, data: rows, summary, chartData })
      }

      case "sla-compliance": {
        let rows
        if (effectiveCompanyId) {
          rows = await sql`
            SELECT
              issue_category,
              COUNT(*) as total,
              COUNT(CASE WHEN due_date IS NOT NULL AND resolved_at IS NOT NULL AND resolved_at::date <= due_date THEN 1 END) as on_time,
              COUNT(CASE WHEN due_date IS NOT NULL AND resolved_at IS NOT NULL AND resolved_at::date > due_date THEN 1 END) as late,
              COUNT(CASE WHEN due_date IS NOT NULL AND status NOT IN ('Resolved','Closed','Completed') AND due_date < CURRENT_DATE THEN 1 END) as currently_overdue
            FROM project_issues
            WHERE company_id = ${effectiveCompanyId}
              AND (is_deleted = false OR is_deleted IS NULL)
              ${dateFrom ? sql`AND created_at >= ${dateFrom}` : sql``}
              ${dateTo ? sql`AND created_at <= ${dateTo}::date + INTERVAL '1 day'` : sql``}
            GROUP BY issue_category
            ORDER BY total DESC
          `
        } else {
          rows = await sql`
            SELECT
              issue_category,
              COUNT(*) as total,
              COUNT(CASE WHEN due_date IS NOT NULL AND resolved_at IS NOT NULL AND resolved_at::date <= due_date THEN 1 END) as on_time,
              COUNT(CASE WHEN due_date IS NOT NULL AND resolved_at IS NOT NULL AND resolved_at::date > due_date THEN 1 END) as late,
              COUNT(CASE WHEN due_date IS NOT NULL AND status NOT IN ('Resolved','Closed','Completed') AND due_date < CURRENT_DATE THEN 1 END) as currently_overdue
            FROM project_issues
            WHERE (is_deleted = false OR is_deleted IS NULL)
              ${dateFrom ? sql`AND created_at >= ${dateFrom}` : sql``}
              ${dateTo ? sql`AND created_at <= ${dateTo}::date + INTERVAL '1 day'` : sql``}
            GROUP BY issue_category
            ORDER BY total DESC
          `
        }

        const totalWithDueDate = rows.reduce((sum: number, r: any) => sum + Number(r.on_time) + Number(r.late) + Number(r.currently_overdue), 0)
        const onTimeResolved = rows.reduce((sum: number, r: any) => sum + Number(r.on_time), 0)
        const lateResolved = rows.reduce((sum: number, r: any) => sum + Number(r.late), 0)
        const currentlyOverdue = rows.reduce((sum: number, r: any) => sum + Number(r.currently_overdue), 0)
        const overallComplianceRate =
          totalWithDueDate > 0 ? Math.round((onTimeResolved / totalWithDueDate) * 1000) / 10 : 0

        const summary = { totalWithDueDate, onTimeResolved, lateResolved, currentlyOverdue, overallComplianceRate }

        const chartData = [
          { name: "On Time", value: onTimeResolved, fill: "#10B981" },
          { name: "Late", value: lateResolved, fill: "#F59E0B" },
          { name: "Overdue", value: currentlyOverdue, fill: "#EF4444" },
        ]

        return NextResponse.json({ type: reportType, data: rows, summary, chartData })
      }

      case "company-performance": {
        if (isCustomer) {
          return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
        }

        const rows = await sql`
          SELECT
            c.name as company_name, c.id as company_id,
            COUNT(DISTINCT ip.id) as total_integrations,
            COUNT(DISTINCT ip.id) FILTER (WHERE ip.status = 'Go Live') as live_integrations,
            COUNT(DISTINCT pi2.id) as total_issues,
            COUNT(DISTINCT pi2.id) FILTER (WHERE pi2.status = 'Escalated') as escalated_issues,
            COUNT(DISTINCT pi2.id) FILTER (WHERE pi2.status IN ('Resolved','Closed','Completed')) as resolved_issues
          FROM companies c
          LEFT JOIN integration_projects ip ON c.id = ip.company_id AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
          LEFT JOIN project_issues pi2 ON c.id = pi2.company_id AND (pi2.is_deleted = false OR pi2.is_deleted IS NULL)
            ${dateFrom ? sql`AND pi2.created_at >= ${dateFrom}` : sql``}
            ${dateTo ? sql`AND pi2.created_at <= ${dateTo}::date + INTERVAL '1 day'` : sql``}
          WHERE c.status = 'Active' AND (c.is_deleted = false OR c.is_deleted IS NULL)
          GROUP BY c.id, c.name
          ORDER BY total_issues DESC
        `

        const totalCompanies = rows.length
        const totalResolvedAll = rows.reduce((sum: number, r: any) => sum + Number(r.resolved_issues), 0)
        const totalIssuesAll = rows.reduce((sum: number, r: any) => sum + Number(r.total_issues), 0)
        const avgResolutionRate = totalIssuesAll > 0 ? Math.round((totalResolvedAll / totalIssuesAll) * 1000) / 10 : 0
        const totalLiveIntegrations = rows.reduce((sum: number, r: any) => sum + Number(r.live_integrations), 0)

        const summary = { totalCompanies, avgResolutionRate, totalLiveIntegrations }

        const chartData = rows.map((r: any) => ({
          name: r.company_name,
          total: Number(r.total_issues),
          resolved: Number(r.resolved_issues),
          escalated: Number(r.escalated_issues),
        }))

        return NextResponse.json({ type: reportType, data: rows, summary, chartData })
      }

      case "integration-lifecycle": {
        let rows
        if (effectiveCompanyId) {
          rows = await sql`
            SELECT
              status,
              COUNT(*) as count,
              AVG(CASE WHEN dev_start_date IS NOT NULL AND dev_end_date IS NOT NULL
                AND dev_start_date >= '2020-01-01' AND dev_end_date >= '2020-01-01'
                AND (dev_end_date - dev_start_date) BETWEEN 0 AND 730
                THEN (dev_end_date - dev_start_date) ELSE NULL END)::numeric(10,1) as avg_dev_days,
              AVG(CASE WHEN internal_testing_start_date IS NOT NULL AND internal_testing_end_date IS NOT NULL
                AND internal_testing_start_date >= '2020-01-01' AND internal_testing_end_date >= '2020-01-01'
                AND (internal_testing_end_date - internal_testing_start_date) BETWEEN 0 AND 730
                THEN (internal_testing_end_date - internal_testing_start_date) ELSE NULL END)::numeric(10,1) as avg_testing_days,
              AVG(CASE WHEN insurer_uat_start_date IS NOT NULL AND insurer_uat_end_date IS NOT NULL
                AND insurer_uat_start_date >= '2020-01-01' AND insurer_uat_end_date >= '2020-01-01'
                AND (insurer_uat_end_date - insurer_uat_start_date) BETWEEN 0 AND 730
                THEN (insurer_uat_end_date - insurer_uat_start_date) ELSE NULL END)::numeric(10,1) as avg_uat_days
            FROM integration_projects
            WHERE company_id = ${effectiveCompanyId}
              AND (is_deleted = false OR is_deleted IS NULL)
            GROUP BY status
            ORDER BY CASE status WHEN 'Not Started' THEN 1 WHEN 'Development' THEN 2 WHEN 'Internal Testing' THEN 3 WHEN 'UAT in Progress' THEN 4 WHEN 'Go Live' THEN 5 ELSE 6 END
          `
        } else {
          rows = await sql`
            SELECT
              status,
              COUNT(*) as count,
              AVG(CASE WHEN dev_start_date IS NOT NULL AND dev_end_date IS NOT NULL
                AND dev_start_date >= '2020-01-01' AND dev_end_date >= '2020-01-01'
                AND (dev_end_date - dev_start_date) BETWEEN 0 AND 730
                THEN (dev_end_date - dev_start_date) ELSE NULL END)::numeric(10,1) as avg_dev_days,
              AVG(CASE WHEN internal_testing_start_date IS NOT NULL AND internal_testing_end_date IS NOT NULL
                AND internal_testing_start_date >= '2020-01-01' AND internal_testing_end_date >= '2020-01-01'
                AND (internal_testing_end_date - internal_testing_start_date) BETWEEN 0 AND 730
                THEN (internal_testing_end_date - internal_testing_start_date) ELSE NULL END)::numeric(10,1) as avg_testing_days,
              AVG(CASE WHEN insurer_uat_start_date IS NOT NULL AND insurer_uat_end_date IS NOT NULL
                AND insurer_uat_start_date >= '2020-01-01' AND insurer_uat_end_date >= '2020-01-01'
                AND (insurer_uat_end_date - insurer_uat_start_date) BETWEEN 0 AND 730
                THEN (insurer_uat_end_date - insurer_uat_start_date) ELSE NULL END)::numeric(10,1) as avg_uat_days
            FROM integration_projects
            WHERE (is_deleted = false OR is_deleted IS NULL)
            GROUP BY status
            ORDER BY CASE status WHEN 'Not Started' THEN 1 WHEN 'Development' THEN 2 WHEN 'Internal Testing' THEN 3 WHEN 'UAT in Progress' THEN 4 WHEN 'Go Live' THEN 5 ELSE 6 END
          `
        }

        const totalProjects = rows.reduce((sum: number, r: any) => sum + Number(r.count), 0)
        const devRows = rows.filter((r: any) => r.avg_dev_days !== null)
        const avgDevDays =
          devRows.length > 0
            ? Math.round((devRows.reduce((sum: number, r: any) => sum + Number(r.avg_dev_days), 0) / devRows.length) * 10) / 10
            : 0
        const testRows = rows.filter((r: any) => r.avg_testing_days !== null)
        const avgTestingDays =
          testRows.length > 0
            ? Math.round((testRows.reduce((sum: number, r: any) => sum + Number(r.avg_testing_days), 0) / testRows.length) * 10) / 10
            : 0
        const uatRows = rows.filter((r: any) => r.avg_uat_days !== null)
        const avgUatDays =
          uatRows.length > 0
            ? Math.round((uatRows.reduce((sum: number, r: any) => sum + Number(r.avg_uat_days), 0) / uatRows.length) * 10) / 10
            : 0

        const summary = { totalProjects, avgDevDays, avgTestingDays, avgUatDays }

        const chartData = rows.map((r: any) => ({
          stage: r.status,
          devDays: Number(r.avg_dev_days) || 0,
          testingDays: Number(r.avg_testing_days) || 0,
          uatDays: Number(r.avg_uat_days) || 0,
        }))

        return NextResponse.json({ type: reportType, data: rows, summary, chartData })
      }

      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 })
    }
  } catch (error) {
    console.error("Reports GET error:", error)
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 })
  }
}
