import { NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    // Verify JWT token and get user info
    let currentUser
    try {
      currentUser = await verifyAuth()
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isCustomer = currentUser.role === "Customer" || currentUser.role === "Customer View Only"
    const isEnsuredit =
      currentUser.role === "Ensuredit" || currentUser.role === "Ensuredit Client Lead" || currentUser.role === "Admin"

    // Query 1: Stage counts with blocker and priority breakdowns
    let stageCountsResult
    if (isCustomer && currentUser.companyId) {
      stageCountsResult = await sql`
        SELECT
          status,
          COUNT(*) as count,
          COUNT(CASE WHEN current_blockers IS NOT NULL AND current_blockers != '' THEN 1 END) as blocked_count,
          COUNT(CASE WHEN priority = 'High' THEN 1 END) as high_priority_count
        FROM integration_projects
        WHERE (is_deleted = false OR is_deleted IS NULL)
          AND company_id = ${currentUser.companyId}
        GROUP BY status
      `
    } else if (isEnsuredit) {
      stageCountsResult = await sql`
        SELECT
          status,
          COUNT(*) as count,
          COUNT(CASE WHEN current_blockers IS NOT NULL AND current_blockers != '' THEN 1 END) as blocked_count,
          COUNT(CASE WHEN priority = 'High' THEN 1 END) as high_priority_count
        FROM integration_projects
        WHERE (is_deleted = false OR is_deleted IS NULL)
        GROUP BY status
      `
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Query 2: Integrations per stage with details
    let integrationsResult
    if (isCustomer && currentUser.companyId) {
      integrationsResult = await sql`
        SELECT
          ip.id, ip.status, ip.priority, ip.current_blockers,
          ip.go_live_planned_date, ip.created_at,
          ip.dev_start_date, ip.internal_testing_start_date, ip.insurer_uat_start_date,
          c.name as company_name,
          i.name as insurer_name,
          p.display_name as product_name,
          sp.display_name as sub_product_name,
          CASE
            WHEN ip.status = 'Development' AND ip.dev_start_date IS NOT NULL
              THEN (CURRENT_DATE - ip.dev_start_date)
            WHEN ip.status = 'Internal Testing' AND ip.internal_testing_start_date IS NOT NULL
              THEN (CURRENT_DATE - ip.internal_testing_start_date)
            WHEN ip.status = 'UAT in Progress' AND ip.insurer_uat_start_date IS NOT NULL
              THEN (CURRENT_DATE - ip.insurer_uat_start_date)
            ELSE (CURRENT_DATE - ip.created_at::date)
          END as days_in_stage
        FROM integration_projects ip
        LEFT JOIN companies c ON ip.company_id = c.id
        LEFT JOIN insurers i ON ip.insurer_id = i.id
        LEFT JOIN products p ON ip.product_id = p.id
        LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
        WHERE (ip.is_deleted = false OR ip.is_deleted IS NULL)
          AND ip.company_id = ${currentUser.companyId}
        ORDER BY ip.priority DESC NULLS LAST, ip.updated_at DESC
      `
    } else {
      integrationsResult = await sql`
        SELECT
          ip.id, ip.status, ip.priority, ip.current_blockers,
          ip.go_live_planned_date, ip.created_at,
          ip.dev_start_date, ip.internal_testing_start_date, ip.insurer_uat_start_date,
          c.name as company_name,
          i.name as insurer_name,
          p.display_name as product_name,
          sp.display_name as sub_product_name,
          CASE
            WHEN ip.status = 'Development' AND ip.dev_start_date IS NOT NULL
              THEN (CURRENT_DATE - ip.dev_start_date)
            WHEN ip.status = 'Internal Testing' AND ip.internal_testing_start_date IS NOT NULL
              THEN (CURRENT_DATE - ip.internal_testing_start_date)
            WHEN ip.status = 'UAT in Progress' AND ip.insurer_uat_start_date IS NOT NULL
              THEN (CURRENT_DATE - ip.insurer_uat_start_date)
            ELSE (CURRENT_DATE - ip.created_at::date)
          END as days_in_stage
        FROM integration_projects ip
        LEFT JOIN companies c ON ip.company_id = c.id
        LEFT JOIN insurers i ON ip.insurer_id = i.id
        LEFT JOIN products p ON ip.product_id = p.id
        LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
        WHERE (ip.is_deleted = false OR ip.is_deleted IS NULL)
        ORDER BY ip.priority DESC NULLS LAST, ip.updated_at DESC
      `
    }

    // Build stages map from the counts query
    const stagesMap: Record<string, { count: number; blocked_count: number; high_priority_count: number }> = {}
    for (const row of stageCountsResult) {
      stagesMap[row.status] = {
        count: Number(row.count) || 0,
        blocked_count: Number(row.blocked_count) || 0,
        high_priority_count: Number(row.high_priority_count) || 0,
      }
    }

    // Build integrations array with proper typing
    const integrations = integrationsResult.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      status: row.status as string,
      priority: row.priority as string | null,
      current_blockers: row.current_blockers as string | null,
      go_live_planned_date: row.go_live_planned_date as string | null,
      created_at: row.created_at as string,
      dev_start_date: row.dev_start_date as string | null,
      internal_testing_start_date: row.internal_testing_start_date as string | null,
      insurer_uat_start_date: row.insurer_uat_start_date as string | null,
      company_name: row.company_name as string | null,
      insurer_name: row.insurer_name as string | null,
      product_name: row.product_name as string | null,
      sub_product_name: row.sub_product_name as string | null,
      days_in_stage: Number(row.days_in_stage) || 0,
    }))

    // Calculate total active (non Go Live) and total live
    const totalActive = integrations.filter(
      (i: { status: string }) => i.status !== "Go Live"
    ).length
    const totalLive = stagesMap["Go Live"]?.count || 0

    return NextResponse.json({
      stages: stagesMap,
      integrations,
      totalActive,
      totalLive,
    })
  } catch (error) {
    console.error("Pipeline data error:", error)
    return NextResponse.json({ error: "Failed to fetch pipeline data" }, { status: 500 })
  }
}
