import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { cookies } from "next/headers"

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret-key-for-development")
const sql = neon(process.env.DATABASE_URL!)

// Function to verify JWT token and get user info
async function verifyTokenAndGetUser(token: string | undefined) {
  if (!token) {
    return { error: "Unauthorized" }
  }

  try {
    const { payload } = await jwtVerify(token, secret)
    return {
      success: true,
      user: {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        companyId: payload.companyId,
        companyName: payload.companyName,
      },
    }
  } catch (error) {
    return { error: "Invalid token" }
  }
}

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
    const cookieStore = await cookies()
    const token = cookieStore.get("auth-token")

    const verificationResult = await verifyTokenAndGetUser(token?.value)
    if (verificationResult.error) {
      return NextResponse.json({ error: verificationResult.error }, { status: 401 })
    }

    const currentUser = verificationResult.user
    const isCustomer = currentUser.role === "Customer" || currentUser.role === "Customer View Only"
    const isEnsuredit =
      currentUser.role === "Ensuredit" || currentUser.role === "Ensuredit Client Lead" || currentUser.role === "Admin"
    const isAdmin = currentUser.role === "Admin"

    console.log("Dashboard access for user:", {
      id: currentUser.id,
      role: currentUser.role,
      companyId: currentUser.companyId,
      isCustomer,
      isEnsuredit,
      isAdmin,
    })

    // Check which tables exist
    const [integrationProjectsExists, projectIssuesExists, usersExists, companiesExists] = await Promise.all([
      tableExists("integration_projects"),
      tableExists("project_issues"),
      tableExists("users"),
      tableExists("companies"),
    ])

    // Get project_issues columns to adapt our queries
    let projectIssuesColumns = []
    if (projectIssuesExists) {
      projectIssuesColumns = await getTableColumns("project_issues")
      console.log("project_issues columns:", projectIssuesColumns)
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
          `
        }

        if (integrationQuery) {
          const [integrationStatsResult] = await integrationQuery
          integrationStats = integrationStatsResult
        }
      } catch (error) {
        console.error("Error fetching integration stats:", error)
      }
    }

    // Fetch Issues Data with role-based filtering
    let statusChartData = []
    let agingChartData = []
    let topCategoriesData = []
    let recentEscalationsData = []
    let recentActivityData = []

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
            issueStats = issueStatsResult
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
              value: Number.parseInt(item.count),
              color: statusColors[item.status] || "#6B7280",
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
      { name: "<30 Days", value: Number.parseInt(issueStats.issues_under_30_days) || 0, color: "#10B981" },
      { name: "30-45 Days", value: Number.parseInt(issueStats.issues_30_to_45_days) || 0, color: "#F59E0B" },
      { name: "45-60 Days", value: Number.parseInt(issueStats.issues_45_to_60_days) || 0, color: "#EF4444" },
      { name: "60+ Days", value: Number.parseInt(issueStats.issues_60_plus_days) || 0, color: "#DC2626" },
    ]

    // System-wide data for Ensuredit users only
    let teamWorkloadData = []
    if (isEnsuredit) {
      if (usersExists) {
        try {
          const [userStatsResult] = await sql`
            SELECT COUNT(*) as total_users FROM users WHERE is_active = true
          `
          userStats = userStatsResult
        } catch (error) {
          console.error("Error fetching user stats:", error)
        }
      }

      if (companiesExists) {
        try {
          const [companyStatsResult] = await sql`
            SELECT COUNT(*) as total_companies FROM companies WHERE status = 'Active'
          `
          companyStats = companyStatsResult
        } catch (error) {
          console.error("Error fetching company stats:", error)
        }
      }

      // Team Workload Data (only for Ensuredit users)
      if (usersExists && projectIssuesExists) {
        try {
          const hasAssignedTo = projectIssuesColumns.includes("assigned_to")

          if (hasAssignedTo) {
            const teamWorkloadResults = await sql`
              SELECT 
                u.name,
                COUNT(CASE WHEN pi.status IN ('Raised', 'New', 'Open', 'In Progress') THEN 1 END) as pending_count,
                COUNT(CASE WHEN pi.status IN ('Raised', 'New', 'Open', 'In Progress') AND pi.created_at < CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as overdue_count
              FROM users u
              LEFT JOIN project_issues pi ON u.id = pi.assigned_to
              WHERE u.role = 'Ensuredit' AND u.is_active = true
              GROUP BY u.id, u.name
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

    return NextResponse.json({
      totalIntegrations: Number.parseInt(integrationStats.total_integrations) || 0,
      activeProjects: Number.parseInt(integrationStats.active_projects) || 0,
      overdueItems: Number.parseInt(integrationStats.overdue_items) || 0,
      thisMonthGoLives: Number.parseInt(integrationStats.this_month_go_lives) || 0,
      totalUsers: isEnsuredit ? Number.parseInt(userStats.total_users) || 0 : 0,
      totalCompanies: isEnsuredit ? Number.parseInt(companyStats.total_companies) || 0 : 0,
      totalIssues: Number.parseInt(issueStats.total_issues) || 0,
      raisedIssues: Number.parseInt(issueStats.raised_issues) || 0,
      inProgressIssues: Number.parseInt(issueStats.in_progress_issues) || 0,
      blockedIssues: Number.parseInt(issueStats.blocked_issues) || 0,
      escalatedIssues: Number.parseInt(issueStats.escalated_issues) || 0,
      resolvedIssues: Number.parseInt(issueStats.resolved_issues) || 0,
      resolutionRate: Number.parseFloat(issueStats.resolution_rate) || 0,
      issuesUnder30Days: Number.parseInt(issueStats.issues_under_30_days) || 0,
      issues30To45Days: Number.parseInt(issueStats.issues_30_to_45_days) || 0,
      issues45To60Days: Number.parseInt(issueStats.issues_45_to_60_days) || 0,
      issues60PlusDays: Number.parseInt(issueStats.issues_60_plus_days) || 0,
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
        id: currentUser.id,
        role: currentUser.role,
        companyId: currentUser.companyId,
        companyName: currentUser.companyName,
      },
      // Debug info
      tablesExist: {
        integration_projects: integrationProjectsExists,
        project_issues: projectIssuesExists,
        users: usersExists,
        companies: companiesExists,
      },
      projectIssuesColumns,
    })
  } catch (error) {
    console.error("Dashboard data error:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 })
  }
}
