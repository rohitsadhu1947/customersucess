import { NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

// Function to check if table exists
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      );
    `
    return result[0].exists
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error)
    return false
  }
}

// Function to get table schema
async function getTableColumns(tableName: string): Promise<string[]> {
  try {
    const result = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = ${tableName};
    `
    return result.map((row) => row.column_name)
  } catch (error) {
    console.error(`Error getting columns for table ${tableName}:`, error)
    return []
  }
}

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
    const isAdmin = currentUser.role === "Admin"

    // Check which tables exist
    const [integrationProjectsExists, projectIssuesExists, usersExists, companiesExists] = await Promise.all([
      tableExists("integration_projects"),
      tableExists("project_issues"),
      tableExists("users"),
      tableExists("companies"),
    ])

    // Get project_issues columns to adapt our queries
    let projectIssuesColumns: string[] = []
    if (projectIssuesExists) {
      projectIssuesColumns = await getTableColumns("project_issues")
    }

    // Initialize default values
    let integrationStats = {
      total_integrations: 0,
      active_projects: 0,
      overdue_items: 0,
      this_month_go_lives: 0,
    }

    let issueStats = {
      total_issues: 0,
      raised_issues: 0,
      in_progress_issues: 0,
      blocked_issues: 0,
      escalated_issues: 0,
      resolved_issues: 0,
      resolution_rate: 0,
      issues_under_30_days: 0,
      issues_30_to_45_days: 0,
      issues_45_to_60_days: 0,
      issues_60_plus_days: 0,
    }

    let userStats = { total_users: 0 }
    let companyStats = { total_companies: 0 }

    // Fetch Integration Projects Data with role-based filtering
    if (integrationProjectsExists) {
      try {
        let integrationQuery
        if (isCustomer && currentUser.companyId) {
          // Customer: Only see their company's integration projects
          integrationQuery = sql`
            SELECT 
              COUNT(*) as total_integrations,
              COUNT(CASE WHEN status IN ('Development', 'Internal Testing', 'UAT in Progress') THEN 1 END) as active_projects,
              COUNT(CASE WHEN go_live_planned_date < CURRENT_DATE AND status != 'Go Live' THEN 1 END) as overdue_items,
              COUNT(CASE WHEN go_live_date >= DATE_TRUNC('month', CURRENT_DATE) 
                             AND go_live_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' 
                             THEN 1 END) as this_month_go_lives
            FROM integration_projects
            WHERE company_id = ${currentUser.companyId}
              AND (is_deleted = false OR is_deleted IS NULL)
          `
        } else if (isEnsuredit) {
          // Ensuredit: See all integration projects
          integrationQuery = sql`
            SELECT
              COUNT(*) as total_integrations,
              COUNT(CASE WHEN status IN ('Development', 'Internal Testing', 'UAT in Progress') THEN 1 END) as active_projects,
              COUNT(CASE WHEN go_live_planned_date < CURRENT_DATE AND status != 'Go Live' THEN 1 END) as overdue_items,
              COUNT(CASE WHEN go_live_date >= DATE_TRUNC('month', CURRENT_DATE)
                             AND go_live_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
                             THEN 1 END) as this_month_go_lives
            FROM integration_projects
            WHERE (is_deleted = false OR is_deleted IS NULL)
          `
        }

        if (integrationQuery) {
          const [integrationStatsResult] = await integrationQuery
          integrationStats = integrationStatsResult as any
        }
      } catch (error) {
        console.error("Error fetching integration stats:", error)
      }
    }

    // Fetch Issues Data with role-based filtering
    let statusChartData: any[] = []
    let agingChartData: any[] = []
    let topCategoriesData: any[] = []
    let recentEscalationsData: any[] = []
    let recentActivityData: any[] = []

    if (projectIssuesExists) {
      try {
        // Check if project_issues has the expected columns
        const hasStatus = projectIssuesColumns.includes("status")
        const hasCategory = projectIssuesColumns.includes("category") || projectIssuesColumns.includes("issue_category")
        const categoryColumn = projectIssuesColumns.includes("category") ? "category" : "issue_category"
        const hasCreatedAt = projectIssuesColumns.includes("created_at")
        const hasUpdatedAt = projectIssuesColumns.includes("updated_at")
        const hasTitle = projectIssuesColumns.includes("title") || projectIssuesColumns.includes("description")
        const titleColumn = projectIssuesColumns.includes("title") ? "title" : "description"
        const hasPriority = projectIssuesColumns.includes("priority")
        const hasCompanyId = projectIssuesColumns.includes("company_id")
        const hasAssignedTo = projectIssuesColumns.includes("assigned_to")

        // Build WHERE clause for role-based filtering
        let whereClause = ""
        let whereParams = []

        if (isCustomer && currentUser.companyId && hasCompanyId) {
          whereClause = "WHERE company_id = $1"
          whereParams = [currentUser.companyId]
        }

        // Issues Stats with role-based filtering
        if (hasStatus && hasCreatedAt) {
          let issueStatsQuery
          if (isCustomer && currentUser.companyId && hasCompanyId) {
            issueStatsQuery = sql`
              SELECT 
                COUNT(*) as total_issues,
                COUNT(CASE WHEN status = 'Raised' OR status = 'New' OR status = 'Open' THEN 1 END) as raised_issues,
                COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_issues,
                COUNT(CASE WHEN status = 'Blocked' THEN 1 END) as blocked_issues,
                COUNT(CASE WHEN status = 'Escalated' THEN 1 END) as escalated_issues,
                COUNT(CASE WHEN status = 'Resolved' OR status = 'Closed' OR status = 'Completed' THEN 1 END) as resolved_issues,
                CASE 
                  WHEN COUNT(*) = 0 THEN 0 
                  ELSE ROUND((COUNT(CASE WHEN status = 'Resolved' OR status = 'Closed' OR status = 'Completed' THEN 1 END) * 100.0 / COUNT(*))::numeric, 2)
                END as resolution_rate,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as issues_under_30_days,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '45 days' AND created_at < CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as issues_30_to_45_days,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '60 days' AND created_at < CURRENT_DATE - INTERVAL '45 days' THEN 1 END) as issues_45_to_60_days,
                COUNT(CASE WHEN created_at < CURRENT_DATE - INTERVAL '60 days' THEN 1 END) as issues_60_plus_days
              FROM project_issues
              WHERE company_id = ${currentUser.companyId}
            `
          } else if (isEnsuredit) {
            issueStatsQuery = sql`
              SELECT 
                COUNT(*) as total_issues,
                COUNT(CASE WHEN status = 'Raised' OR status = 'New' OR status = 'Open' THEN 1 END) as raised_issues,
                COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_issues,
                COUNT(CASE WHEN status = 'Blocked' THEN 1 END) as blocked_issues,
                COUNT(CASE WHEN status = 'Escalated' THEN 1 END) as escalated_issues,
                COUNT(CASE WHEN status = 'Resolved' OR status = 'Closed' OR status = 'Completed' THEN 1 END) as resolved_issues,
                CASE 
                  WHEN COUNT(*) = 0 THEN 0 
                  ELSE ROUND((COUNT(CASE WHEN status = 'Resolved' OR status = 'Closed' OR status = 'Completed' THEN 1 END) * 100.0 / COUNT(*))::numeric, 2)
                END as resolution_rate,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as issues_under_30_days,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '45 days' AND created_at < CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as issues_30_to_45_days,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '60 days' AND created_at < CURRENT_DATE - INTERVAL '45 days' THEN 1 END) as issues_45_to_60_days,
                COUNT(CASE WHEN created_at < CURRENT_DATE - INTERVAL '60 days' THEN 1 END) as issues_60_plus_days
              FROM project_issues
            `
          }

          if (issueStatsQuery) {
            const [issueStatsResult] = await issueStatsQuery
            issueStats = issueStatsResult as any
          }
        }

        // Issue Status Distribution with role-based filtering
        if (hasStatus) {
          let statusQuery
          if (isCustomer && currentUser.companyId && hasCompanyId) {
            statusQuery = sql`
              SELECT 
                status,
                COUNT(*) as count
              FROM project_issues
              WHERE company_id = ${currentUser.companyId}
              GROUP BY status
              ORDER BY count DESC
            `
          } else if (isEnsuredit) {
            statusQuery = sql`
              SELECT 
                status,
                COUNT(*) as count
              FROM project_issues
              GROUP BY status
              ORDER BY count DESC
            `
          }

          if (statusQuery) {
            const issueStatusResults = await statusQuery

            const statusColors = {
              Raised: "#3B82F6",
              New: "#3B82F6",
              Open: "#3B82F6",
              "In Progress": "#F59E0B",
              Blocked: "#EF4444",
              Escalated: "#DC2626",
              Resolved: "#10B981",
              Closed: "#10B981",
              Completed: "#10B981",
            }

            statusChartData = issueStatusResults.map((item) => ({
              name: item.status,
              value: Number(item.count),
              color: (statusColors as Record<string, string>)[item.status] || "#6B7280",
            }))
          }
        }

        // Top Issue Categories with role-based filtering
        if (hasCategory && hasStatus && hasCreatedAt) {
          let topCategoriesQuery
          if (isCustomer && currentUser.companyId && hasCompanyId) {
            if (categoryColumn === "category") {
              topCategoriesQuery = sql`
                SELECT 
                  category as issue_category,
                  COUNT(*) as count,
                  CASE 
                    WHEN COUNT(*) = 0 THEN 0 
                    ELSE ROUND((COUNT(CASE WHEN status = 'Resolved' OR status = 'Closed' OR status = 'Completed' THEN 1 END) * 100.0 / COUNT(*))::numeric, 2)
                  END as resolution_rate
                FROM project_issues
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' AND company_id = ${currentUser.companyId}
                GROUP BY category
                ORDER BY count DESC
                LIMIT 5
              `
            } else {
              topCategoriesQuery = sql`
                SELECT 
                  issue_category,
                  COUNT(*) as count,
                  CASE 
                    WHEN COUNT(*) = 0 THEN 0 
                    ELSE ROUND((COUNT(CASE WHEN status = 'Resolved' OR status = 'Closed' OR status = 'Completed' THEN 1 END) * 100.0 / COUNT(*))::numeric, 2)
                  END as resolution_rate
                FROM project_issues
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' AND company_id = ${currentUser.companyId}
                GROUP BY issue_category
                ORDER BY count DESC
                LIMIT 5
              `
            }
          } else if (isEnsuredit) {
            if (categoryColumn === "category") {
              topCategoriesQuery = sql`
                SELECT 
                  category as issue_category,
                  COUNT(*) as count,
                  CASE 
                    WHEN COUNT(*) = 0 THEN 0 
                    ELSE ROUND((COUNT(CASE WHEN status = 'Resolved' OR status = 'Closed' OR status = 'Completed' THEN 1 END) * 100.0 / COUNT(*))::numeric, 2)
                  END as resolution_rate
                FROM project_issues
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY category
                ORDER BY count DESC
                LIMIT 5
              `
            } else {
              topCategoriesQuery = sql`
                SELECT 
                  issue_category,
                  COUNT(*) as count,
                  CASE 
                    WHEN COUNT(*) = 0 THEN 0 
                    ELSE ROUND((COUNT(CASE WHEN status = 'Resolved' OR status = 'Closed' OR status = 'Completed' THEN 1 END) * 100.0 / COUNT(*))::numeric, 2)
                  END as resolution_rate
                FROM project_issues
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY issue_category
                ORDER BY count DESC
                LIMIT 5
              `
            }
          }

          if (topCategoriesQuery) {
            topCategoriesData = await topCategoriesQuery
          }
        }

        // Recent Escalations with role-based filtering
        if (hasStatus && hasTitle && hasUpdatedAt) {
          let escalationsQuery
          if (isCustomer && currentUser.companyId && hasCompanyId) {
            if (companiesExists) {
              if (titleColumn === "title") {
                escalationsQuery = sql`
                  SELECT 
                    pi.title,
                    ${hasCategory ? (categoryColumn === "category" ? sql`pi.category` : sql`pi.issue_category`) : sql`'General'`} as issue_category,
                    ${hasPriority ? sql`pi.priority` : sql`'High'`} as priority,
                    pi.updated_at,
                    c.name as company_name
                  FROM project_issues pi
                  LEFT JOIN companies c ON pi.company_id = c.id
                  WHERE pi.status = 'Escalated' AND pi.company_id = ${currentUser.companyId}
                  ORDER BY pi.updated_at DESC
                  LIMIT 5
                `
              } else {
                escalationsQuery = sql`
                  SELECT 
                    pi.description as title,
                    ${hasCategory ? (categoryColumn === "category" ? sql`pi.category` : sql`pi.issue_category`) : sql`'General'`} as issue_category,
                    ${hasPriority ? sql`pi.priority` : sql`'High'`} as priority,
                    pi.updated_at,
                    c.name as company_name
                  FROM project_issues pi
                  LEFT JOIN companies c ON pi.company_id = c.id
                  WHERE pi.status = 'Escalated' AND pi.company_id = ${currentUser.companyId}
                  ORDER BY pi.updated_at DESC
                  LIMIT 5
                `
              }
            } else {
              if (titleColumn === "title") {
                escalationsQuery = sql`
                  SELECT 
                    title,
                    ${hasCategory ? (categoryColumn === "category" ? sql`category` : sql`issue_category`) : sql`'General'`} as issue_category,
                    ${hasPriority ? sql`priority` : sql`'High'`} as priority,
                    updated_at,
                    ${sql`${currentUser.companyName || "Your Company"}`} as company_name
                  FROM project_issues
                  WHERE status = 'Escalated' AND company_id = ${currentUser.companyId}
                  ORDER BY updated_at DESC
                  LIMIT 5
                `
              } else {
                escalationsQuery = sql`
                  SELECT 
                    description as title,
                    ${hasCategory ? (categoryColumn === "category" ? sql`category` : sql`issue_category`) : sql`'General'`} as issue_category,
                    ${hasPriority ? sql`priority` : sql`'High'`} as priority,
                    updated_at,
                    ${sql`${currentUser.companyName || "Your Company"}`} as company_name
                  FROM project_issues
                  WHERE status = 'Escalated' AND company_id = ${currentUser.companyId}
                  ORDER BY updated_at DESC
                  LIMIT 5
                `
              }
            }
          } else if (isEnsuredit) {
            // Ensuredit sees all escalations (existing logic)
            if (companiesExists && hasCompanyId) {
              if (titleColumn === "title") {
                escalationsQuery = sql`
                  SELECT 
                    pi.title,
                    ${hasCategory ? (categoryColumn === "category" ? sql`pi.category` : sql`pi.issue_category`) : sql`'General'`} as issue_category,
                    ${hasPriority ? sql`pi.priority` : sql`'High'`} as priority,
                    pi.updated_at,
                    c.name as company_name
                  FROM project_issues pi
                  LEFT JOIN companies c ON pi.company_id = c.id
                  WHERE pi.status = 'Escalated'
                  ORDER BY pi.updated_at DESC
                  LIMIT 5
                `
              } else {
                escalationsQuery = sql`
                  SELECT 
                    pi.description as title,
                    ${hasCategory ? (categoryColumn === "category" ? sql`pi.category` : sql`pi.issue_category`) : sql`'General'`} as issue_category,
                    ${hasPriority ? sql`pi.priority` : sql`'High'`} as priority,
                    pi.updated_at,
                    c.name as company_name
                  FROM project_issues pi
                  LEFT JOIN companies c ON pi.company_id = c.id
                  WHERE pi.status = 'Escalated'
                  ORDER BY pi.updated_at DESC
                  LIMIT 5
                `
              }
            }
          }

          if (escalationsQuery) {
            recentEscalationsData = await escalationsQuery
          }
        }

        // Recent Activity with role-based filtering
        if (hasStatus && hasTitle && hasUpdatedAt) {
          let activityQuery
          if (isCustomer && currentUser.companyId && hasCompanyId) {
            if (companiesExists) {
              if (titleColumn === "title") {
                activityQuery = sql`
                  SELECT 
                    pi.title,
                    ${hasCategory ? (categoryColumn === "category" ? sql`pi.category` : sql`pi.issue_category`) : sql`'General'`} as issue_category,
                    pi.status,
                    pi.updated_at,
                    c.name as company_name
                  FROM project_issues pi
                  LEFT JOIN companies c ON pi.company_id = c.id
                  WHERE pi.updated_at >= CURRENT_DATE - INTERVAL '7 days' AND pi.company_id = ${currentUser.companyId}
                  ORDER BY pi.updated_at DESC
                  LIMIT 10
                `
              } else {
                activityQuery = sql`
                  SELECT 
                    pi.description as title,
                    ${hasCategory ? (categoryColumn === "category" ? sql`pi.category` : sql`pi.issue_category`) : sql`'General'`} as issue_category,
                    pi.status,
                    pi.updated_at,
                    c.name as company_name
                  FROM project_issues pi
                  LEFT JOIN companies c ON pi.company_id = c.id
                  WHERE pi.updated_at >= CURRENT_DATE - INTERVAL '7 days' AND pi.company_id = ${currentUser.companyId}
                  ORDER BY pi.updated_at DESC
                  LIMIT 10
                `
              }
            } else {
              if (titleColumn === "title") {
                activityQuery = sql`
                  SELECT 
                    title,
                    ${hasCategory ? (categoryColumn === "category" ? sql`category` : sql`issue_category`) : sql`'General'`} as issue_category,
                    status,
                    updated_at,
                    ${sql`${currentUser.companyName || "Your Company"}`} as company_name
                  FROM project_issues
                  WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days' AND company_id = ${currentUser.companyId}
                  ORDER BY updated_at DESC
                  LIMIT 10
                `
              } else {
                activityQuery = sql`
                  SELECT 
                    description as title,
                    ${hasCategory ? (categoryColumn === "category" ? sql`category` : sql`issue_category`) : sql`'General'`} as issue_category,
                    status,
                    updated_at,
                    ${sql`${currentUser.companyName || "Your Company"}`} as company_name
                  FROM project_issues
                  WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days' AND company_id = ${currentUser.companyId}
                  ORDER BY updated_at DESC
                  LIMIT 10
                `
              }
            }
          } else if (isEnsuredit) {
            // Ensuredit sees all activity (existing logic)
            if (companiesExists && hasCompanyId) {
              if (titleColumn === "title") {
                activityQuery = sql`
                  SELECT 
                    pi.title,
                    ${hasCategory ? (categoryColumn === "category" ? sql`pi.category` : sql`pi.issue_category`) : sql`'General'`} as issue_category,
                    pi.status,
                    pi.updated_at,
                    c.name as company_name
                  FROM project_issues pi
                  LEFT JOIN companies c ON pi.company_id = c.id
                  WHERE pi.updated_at >= CURRENT_DATE - INTERVAL '7 days'
                  ORDER BY pi.updated_at DESC
                  LIMIT 10
                `
              } else {
                activityQuery = sql`
                  SELECT 
                    pi.description as title,
                    ${hasCategory ? (categoryColumn === "category" ? sql`pi.category` : sql`pi.issue_category`) : sql`'General'`} as issue_category,
                    pi.status,
                    pi.updated_at,
                    c.name as company_name
                  FROM project_issues pi
                  LEFT JOIN companies c ON pi.company_id = c.id
                  WHERE pi.updated_at >= CURRENT_DATE - INTERVAL '7 days'
                  ORDER BY pi.updated_at DESC
                  LIMIT 10
                `
              }
            }
          }

          if (activityQuery) {
            recentActivityData = await activityQuery
          }
        }
      } catch (error) {
        console.error("Error fetching issues data:", error)
      }
    } else {
      // Provide sample data when project_issues table doesn't exist
      statusChartData = [
        { name: "Raised", value: 5, color: "#3B82F6" },
        { name: "In Progress", value: 8, color: "#F59E0B" },
        { name: "Resolved", value: 12, color: "#10B981" },
      ]

      topCategoriesData = [
        { issue_category: "Integration Setup", count: 3, resolution_rate: 66.7 },
        { issue_category: "Data Mapping", count: 2, resolution_rate: 50.0 },
      ]
    }

    // Issue Aging Data
    agingChartData = [
      { name: "<30 Days", value: Number(issueStats.issues_under_30_days) || 0, color: "#10B981" },
      { name: "30-45 Days", value: Number(issueStats.issues_30_to_45_days) || 0, color: "#F59E0B" },
      { name: "45-60 Days", value: Number(issueStats.issues_45_to_60_days) || 0, color: "#EF4444" },
      { name: "60+ Days", value: Number(issueStats.issues_60_plus_days) || 0, color: "#DC2626" },
    ]

    // System-wide data for Ensuredit users only
    let teamWorkloadData: any[] = []
    if (isEnsuredit) {
      if (usersExists) {
        try {
          const [userStatsResult] = await sql`
            SELECT COUNT(*) as total_users FROM users WHERE is_active = true
          `
          userStats = userStatsResult as any
        } catch (error) {
          console.error("Error fetching user stats:", error)
        }
      }

      if (companiesExists) {
        try {
          const [companyStatsResult] = await sql`
            SELECT COUNT(*) as total_companies FROM companies WHERE status = 'Active'
          `
          companyStats = companyStatsResult as any
        } catch (error) {
          console.error("Error fetching company stats:", error)
        }
      }

      // Team Workload Data (only for Ensuredit users)
      if (usersExists && projectIssuesExists) {
        try {
          const hasAssignedTo = projectIssuesColumns.includes("assigned_to_id") || projectIssuesColumns.includes("assigned_to")

          if (hasAssignedTo) {
            const teamWorkloadResults = await sql`
              SELECT
                u.name,
                COUNT(CASE WHEN pi.status IN ('Raised', 'New', 'Open', 'In Progress') THEN 1 END) as pending_count,
                COUNT(CASE WHEN pi.status IN ('Raised', 'New', 'Open', 'In Progress') AND pi.created_at < CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as overdue_count
              FROM users u
              LEFT JOIN project_issues pi ON u.id = pi.assigned_to_id
              WHERE u.role_type IN ('Ensuredit', 'Ensuredit Client Lead', 'Admin') AND u.is_active = true
              GROUP BY u.id, u.name
              HAVING COUNT(CASE WHEN pi.status IN ('Raised', 'New', 'Open', 'In Progress') THEN 1 END) > 0
              ORDER BY pending_count DESC
              LIMIT 10
            `
            teamWorkloadData = teamWorkloadResults
          }
        } catch (error) {
          console.error("Error fetching team workload:", error)
        }
      }
    }

    // ==========================================
    // SECTION: Monthly Trends (last 6 months)
    // ==========================================
    let trendsData: {
      issuesCreated: { month: string; count: number }[]
      issuesResolved: { month: string; count: number }[]
      goLives: { month: string; count: number }[]
    } = { issuesCreated: [], issuesResolved: [], goLives: [] }

    try {
      if (projectIssuesExists) {
        let issuesTrendQuery
        if (isCustomer && currentUser.companyId) {
          issuesTrendQuery = sql`
            SELECT
              TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
              COUNT(*) as created,
              COUNT(CASE WHEN status IN ('Resolved','Closed','Completed') THEN 1 END) as resolved
            FROM project_issues
            WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
              AND (is_deleted = false OR is_deleted IS NULL)
              AND company_id = ${currentUser.companyId}
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at)
          `
        } else if (isEnsuredit) {
          issuesTrendQuery = sql`
            SELECT
              TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
              COUNT(*) as created,
              COUNT(CASE WHEN status IN ('Resolved','Closed','Completed') THEN 1 END) as resolved
            FROM project_issues
            WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
              AND (is_deleted = false OR is_deleted IS NULL)
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at)
          `
        }

        if (issuesTrendQuery) {
          const issuesTrendResults = await issuesTrendQuery
          trendsData.issuesCreated = issuesTrendResults.map((row: any) => ({
            month: row.month,
            count: Number(row.created) || 0,
          }))
          trendsData.issuesResolved = issuesTrendResults.map((row: any) => ({
            month: row.month,
            count: Number(row.resolved) || 0,
          }))
        }
      }

      if (integrationProjectsExists) {
        let goLivesTrendQuery
        if (isCustomer && currentUser.companyId) {
          goLivesTrendQuery = sql`
            SELECT
              TO_CHAR(DATE_TRUNC('month', go_live_date), 'YYYY-MM') as month,
              COUNT(*) as count
            FROM integration_projects
            WHERE go_live_date >= CURRENT_DATE - INTERVAL '6 months'
              AND go_live_date IS NOT NULL
              AND (is_deleted = false OR is_deleted IS NULL)
              AND company_id = ${currentUser.companyId}
            GROUP BY DATE_TRUNC('month', go_live_date)
            ORDER BY DATE_TRUNC('month', go_live_date)
          `
        } else if (isEnsuredit) {
          goLivesTrendQuery = sql`
            SELECT
              TO_CHAR(DATE_TRUNC('month', go_live_date), 'YYYY-MM') as month,
              COUNT(*) as count
            FROM integration_projects
            WHERE go_live_date >= CURRENT_DATE - INTERVAL '6 months'
              AND go_live_date IS NOT NULL
              AND (is_deleted = false OR is_deleted IS NULL)
            GROUP BY DATE_TRUNC('month', go_live_date)
            ORDER BY DATE_TRUNC('month', go_live_date)
          `
        }

        if (goLivesTrendQuery) {
          const goLivesTrendResults = await goLivesTrendQuery
          trendsData.goLives = goLivesTrendResults.map((row: any) => ({
            month: row.month,
            count: Number(row.count) || 0,
          }))
        }
      }
    } catch (error) {
      console.error("Error fetching monthly trends:", error)
    }

    // ==========================================
    // SECTION: Period Comparison (this month vs last month)
    // ==========================================
    let periodComparison = {
      issuesThisMonth: 0,
      issuesLastMonth: 0,
      issuesChange: 0,
      escalationsThisMonth: 0,
      escalationsLastMonth: 0,
      escalationsChange: 0,
      integrationsThisMonth: 0,
      integrationsLastMonth: 0,
      integrationsChange: 0,
    }

    try {
      // Issues period comparison
      if (projectIssuesExists) {
        let issuesPeriodQuery
        if (isCustomer && currentUser.companyId) {
          issuesPeriodQuery = sql`
            SELECT
              COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month,
              COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                AND created_at < DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as last_month
            FROM project_issues
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
              AND (is_deleted = false OR is_deleted IS NULL)
              AND company_id = ${currentUser.companyId}
          `
        } else if (isEnsuredit) {
          issuesPeriodQuery = sql`
            SELECT
              COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month,
              COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                AND created_at < DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as last_month
            FROM project_issues
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
              AND (is_deleted = false OR is_deleted IS NULL)
          `
        }

        if (issuesPeriodQuery) {
          const [issuesPeriodResult] = await issuesPeriodQuery
          const thisMonth = Number(issuesPeriodResult.this_month) || 0
          const lastMonth = Number(issuesPeriodResult.last_month) || 0
          periodComparison.issuesThisMonth = thisMonth
          periodComparison.issuesLastMonth = lastMonth
          periodComparison.issuesChange = lastMonth === 0 ? 0 : Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
        }
      }

      // Escalations period comparison
      if (projectIssuesExists) {
        let escalationsPeriodQuery
        if (isCustomer && currentUser.companyId) {
          escalationsPeriodQuery = sql`
            SELECT
              COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month,
              COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                AND created_at < DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as last_month
            FROM project_issues
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
              AND status = 'Escalated'
              AND (is_deleted = false OR is_deleted IS NULL)
              AND company_id = ${currentUser.companyId}
          `
        } else if (isEnsuredit) {
          escalationsPeriodQuery = sql`
            SELECT
              COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month,
              COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                AND created_at < DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as last_month
            FROM project_issues
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
              AND status = 'Escalated'
              AND (is_deleted = false OR is_deleted IS NULL)
          `
        }

        if (escalationsPeriodQuery) {
          const [escalationsPeriodResult] = await escalationsPeriodQuery
          const thisMonth = Number(escalationsPeriodResult.this_month) || 0
          const lastMonth = Number(escalationsPeriodResult.last_month) || 0
          periodComparison.escalationsThisMonth = thisMonth
          periodComparison.escalationsLastMonth = lastMonth
          periodComparison.escalationsChange = lastMonth === 0 ? 0 : Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
        }
      }

      // Integrations period comparison
      if (integrationProjectsExists) {
        let integrationsPeriodQuery
        if (isCustomer && currentUser.companyId) {
          integrationsPeriodQuery = sql`
            SELECT
              COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month,
              COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                AND created_at < DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as last_month
            FROM integration_projects
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
              AND (is_deleted = false OR is_deleted IS NULL)
              AND company_id = ${currentUser.companyId}
          `
        } else if (isEnsuredit) {
          integrationsPeriodQuery = sql`
            SELECT
              COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month,
              COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                AND created_at < DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as last_month
            FROM integration_projects
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
              AND (is_deleted = false OR is_deleted IS NULL)
          `
        }

        if (integrationsPeriodQuery) {
          const [integrationsPeriodResult] = await integrationsPeriodQuery
          const thisMonth = Number(integrationsPeriodResult.this_month) || 0
          const lastMonth = Number(integrationsPeriodResult.last_month) || 0
          periodComparison.integrationsThisMonth = thisMonth
          periodComparison.integrationsLastMonth = lastMonth
          periodComparison.integrationsChange = lastMonth === 0 ? 0 : Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
        }
      }
    } catch (error) {
      console.error("Error fetching period comparison:", error)
    }

    // ==========================================
    // SECTION: Pipeline Overview
    // ==========================================
    let pipelineOverview: { stage: string; count: number; percentage: number }[] = []

    try {
      if (integrationProjectsExists) {
        let pipelineQuery
        if (isCustomer && currentUser.companyId) {
          pipelineQuery = sql`
            SELECT
              status,
              COUNT(*) as count
            FROM integration_projects
            WHERE (is_deleted = false OR is_deleted IS NULL)
              AND company_id = ${currentUser.companyId}
            GROUP BY status
            ORDER BY CASE status
              WHEN 'Not Started' THEN 1
              WHEN 'Development' THEN 2
              WHEN 'Internal Testing' THEN 3
              WHEN 'UAT in Progress' THEN 4
              WHEN 'Go Live' THEN 5
              ELSE 6
            END
          `
        } else if (isEnsuredit) {
          pipelineQuery = sql`
            SELECT
              status,
              COUNT(*) as count
            FROM integration_projects
            WHERE (is_deleted = false OR is_deleted IS NULL)
            GROUP BY status
            ORDER BY CASE status
              WHEN 'Not Started' THEN 1
              WHEN 'Development' THEN 2
              WHEN 'Internal Testing' THEN 3
              WHEN 'UAT in Progress' THEN 4
              WHEN 'Go Live' THEN 5
              ELSE 6
            END
          `
        }

        if (pipelineQuery) {
          const pipelineResults = await pipelineQuery
          const totalPipeline = pipelineResults.reduce((sum: number, row: any) => sum + Number(row.count), 0)
          pipelineOverview = pipelineResults.map((row: any) => ({
            stage: row.status,
            count: Number(row.count) || 0,
            percentage: totalPipeline > 0 ? Math.round((Number(row.count) / totalPipeline) * 100) : 0,
          }))
        }
      }
    } catch (error) {
      console.error("Error fetching pipeline overview:", error)
    }

    // ==========================================
    // SECTION: SLA Tracking
    // ==========================================
    let slaTracking: {
      approaching: number
      overdue: number
      overdueIssues: { id: string; title: string; company_name: string; due_date: string; days_overdue: number; priority: string }[]
    } = { approaching: 0, overdue: 0, overdueIssues: [] }

    try {
      if (projectIssuesExists) {
        const hasDueDate = projectIssuesColumns.includes("due_date")
        const hasStatus = projectIssuesColumns.includes("status")
        const hasTitleCol = projectIssuesColumns.includes("title")
        const hasPriorityCol = projectIssuesColumns.includes("priority")

        if (hasDueDate && hasStatus) {
          let slaQuery
          if (isCustomer && currentUser.companyId) {
            slaQuery = sql`
              SELECT
                pi.id,
                ${hasTitleCol ? sql`pi.title` : sql`pi.description`} as title,
                pi.due_date,
                pi.status,
                ${hasPriorityCol ? sql`pi.priority` : sql`'Medium'`} as priority,
                c.name as company_name,
                EXTRACT(DAY FROM CURRENT_DATE - pi.due_date)::int as days_overdue
              FROM project_issues pi
              LEFT JOIN companies c ON pi.company_id = c.id
              WHERE pi.status NOT IN ('Resolved','Closed','Completed')
                AND pi.due_date IS NOT NULL
                AND pi.due_date <= CURRENT_DATE + INTERVAL '3 days'
                AND (pi.is_deleted = false OR pi.is_deleted IS NULL)
                AND pi.company_id = ${currentUser.companyId}
              ORDER BY pi.due_date ASC
              LIMIT 10
            `
          } else if (isEnsuredit) {
            slaQuery = sql`
              SELECT
                pi.id,
                ${hasTitleCol ? sql`pi.title` : sql`pi.description`} as title,
                pi.due_date,
                pi.status,
                ${hasPriorityCol ? sql`pi.priority` : sql`'Medium'`} as priority,
                c.name as company_name,
                EXTRACT(DAY FROM CURRENT_DATE - pi.due_date)::int as days_overdue
              FROM project_issues pi
              LEFT JOIN companies c ON pi.company_id = c.id
              WHERE pi.status NOT IN ('Resolved','Closed','Completed')
                AND pi.due_date IS NOT NULL
                AND pi.due_date <= CURRENT_DATE + INTERVAL '3 days'
                AND (pi.is_deleted = false OR pi.is_deleted IS NULL)
              ORDER BY pi.due_date ASC
              LIMIT 10
            `
          }

          if (slaQuery) {
            const slaResults = await slaQuery
            let approachingCount = 0
            let overdueCount = 0
            const overdueIssuesList: typeof slaTracking.overdueIssues = []

            for (const row of slaResults) {
              const daysOverdue = Number(row.days_overdue) || 0
              if (daysOverdue > 0) {
                // due_date < today → overdue
                overdueCount++
                overdueIssuesList.push({
                  id: row.id,
                  title: row.title,
                  company_name: row.company_name || "Unknown",
                  due_date: row.due_date,
                  days_overdue: daysOverdue,
                  priority: row.priority,
                })
              } else {
                // due_date between today and today+3 → approaching
                approachingCount++
              }
            }

            slaTracking = {
              approaching: approachingCount,
              overdue: overdueCount,
              overdueIssues: overdueIssuesList,
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching SLA tracking:", error)
    }

    // ==========================================
    // SECTION: Company Health Overview (Ensuredit only)
    // ==========================================
    let companyHealthOverview: {
      id: string
      name: string
      healthScore: number
      openIssues: number
      escalatedIssues: number
      liveIntegrations: number
      totalIntegrations: number
    }[] = []

    try {
      if (isEnsuredit && companiesExists && integrationProjectsExists && projectIssuesExists) {
        const healthResults = await sql`
          SELECT
            c.id,
            c.name,
            COALESCE(ip_stats.total_integrations, 0) as total_integrations,
            COALESCE(ip_stats.live_integrations, 0) as live_integrations,
            COALESCE(pi_stats.total_issues, 0) as total_issues,
            COALESCE(pi_stats.open_issues, 0) as open_issues,
            COALESCE(pi_stats.escalated_issues, 0) as escalated_issues,
            COALESCE(pi_stats.resolved_issues, 0) as resolved_issues
          FROM companies c
          LEFT JOIN (
            SELECT
              company_id,
              COUNT(*) as total_integrations,
              COUNT(CASE WHEN status = 'Go Live' THEN 1 END) as live_integrations
            FROM integration_projects
            WHERE (is_deleted = false OR is_deleted IS NULL)
            GROUP BY company_id
          ) ip_stats ON c.id = ip_stats.company_id
          LEFT JOIN (
            SELECT
              company_id,
              COUNT(*) as total_issues,
              COUNT(CASE WHEN status NOT IN ('Resolved','Closed','Completed') THEN 1 END) as open_issues,
              COUNT(CASE WHEN status = 'Escalated' THEN 1 END) as escalated_issues,
              COUNT(CASE WHEN status IN ('Resolved','Closed','Completed') THEN 1 END) as resolved_issues
            FROM project_issues
            WHERE (is_deleted = false OR is_deleted IS NULL)
            GROUP BY company_id
          ) pi_stats ON c.id = pi_stats.company_id
          WHERE c.status = 'Active'
          ORDER BY c.name
        `

        companyHealthOverview = healthResults.map((row: any) => {
          const totalIssuesNum = Number(row.total_issues) || 0
          const escalatedNum = Number(row.escalated_issues) || 0
          const resolvedNum = Number(row.resolved_issues) || 0
          const totalIntegrationsNum = Number(row.total_integrations) || 0
          const liveIntegrationsNum = Number(row.live_integrations) || 0

          let healthScore = 100

          // Escalation rate penalty
          if (totalIssuesNum > 0) {
            const escalationRate = escalatedNum / totalIssuesNum
            healthScore -= escalationRate * 40
          }

          // Resolution rate adjustment
          if (totalIssuesNum > 0) {
            const resolutionRate = resolvedNum / totalIssuesNum
            healthScore += (resolutionRate - 0.5) * 20
          }

          // Live rate adjustment
          if (totalIntegrationsNum > 0) {
            const liveRate = liveIntegrationsNum / totalIntegrationsNum
            healthScore += (liveRate - 0.3) * 30
          }

          // Clamp to 0-100
          healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))

          return {
            id: row.id,
            name: row.name,
            healthScore,
            openIssues: Number(row.open_issues) || 0,
            escalatedIssues: escalatedNum,
            liveIntegrations: liveIntegrationsNum,
            totalIntegrations: totalIntegrationsNum,
          }
        })

        // Sort by healthScore descending, then take top 5 healthiest + bottom 5 at-risk
        const sorted = [...companyHealthOverview].sort((a, b) => b.healthScore - a.healthScore)
        if (sorted.length > 10) {
          const top5 = sorted.slice(0, 5)
          const bottom5 = sorted.slice(-5)
          // Merge without duplicates, preserving sorted order
          const mergedIds = new Set<string>()
          const merged: typeof companyHealthOverview = []
          for (const item of [...top5, ...bottom5]) {
            if (!mergedIds.has(item.id)) {
              mergedIds.add(item.id)
              merged.push(item)
            }
          }
          companyHealthOverview = merged
        }
      }
    } catch (error) {
      console.error("Error fetching company health overview:", error)
    }

    return NextResponse.json({
      totalIntegrations: Number(integrationStats.total_integrations) || 0,
      activeProjects: Number(integrationStats.active_projects) || 0,
      overdueItems: Number(integrationStats.overdue_items) || 0,
      thisMonthGoLives: Number(integrationStats.this_month_go_lives) || 0,
      totalUsers: isEnsuredit ? Number(userStats.total_users) || 0 : 0,
      totalCompanies: isEnsuredit ? Number(companyStats.total_companies) || 0 : 0,
      totalIssues: Number(issueStats.total_issues) || 0,
      raisedIssues: Number(issueStats.raised_issues) || 0,
      inProgressIssues: Number(issueStats.in_progress_issues) || 0,
      blockedIssues: Number(issueStats.blocked_issues) || 0,
      escalatedIssues: Number(issueStats.escalated_issues) || 0,
      resolvedIssues: Number(issueStats.resolved_issues) || 0,
      resolutionRate: Number(issueStats.resolution_rate) || 0,
      issuesUnder30Days: Number(issueStats.issues_under_30_days) || 0,
      issues30To45Days: Number(issueStats.issues_30_to_45_days) || 0,
      issues45To60Days: Number(issueStats.issues_45_to_60_days) || 0,
      issues60PlusDays: Number(issueStats.issues_60_plus_days) || 0,
      statusChartData,
      agingChartData,
      topIssueCategories: topCategoriesData,
      pendingWithTeam: teamWorkloadData,
      recentEscalations: recentEscalationsData,
      recentActivity: recentActivityData,
      userRole: currentUser.role,
      isCustomer,
      isEnsuredit,
      currentUser: {
        id: currentUser.userId,
        role: currentUser.role,
        companyId: currentUser.companyId,
        companyName: currentUser.companyName,
      },
      trends: trendsData,
      periodComparison,
      pipelineOverview,
      slaTracking,
      companyHealthOverview: isEnsuredit ? companyHealthOverview : [],
    })
  } catch (error) {
    console.error("Dashboard data error:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 })
  }
}
