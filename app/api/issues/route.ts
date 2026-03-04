import { neon } from "@neondatabase/serverless"
import { type NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { cookies } from "next/headers"

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret-key-for-development")
const sql = neon(process.env.DATABASE_URL!)

async function verifyAuth(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")

  if (!token) {
    throw new Error("No token provided")
  }

  const { payload } = await jwtVerify(token.value, secret)
  return payload
}

// GET - Fetch all project status items with related data
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const category = searchParams.get("category")
    const priority = searchParams.get("priority")
    const companyId = searchParams.get("company_id")

    console.log("GET request params:", { status, category, priority, companyId })
    console.log("User:", { role: user.role, companyId: user.companyId })

    // Test basic query first
    const testQuery = await sql`SELECT COUNT(*) as count FROM project_issues`
    console.log("Total records in project_issues table:", testQuery[0]?.count)

    let issues

    // Role-based filtering with simplified queries
    if (user.role === "Customer" || user.role === "Customer View Only") {
      // Customer can only see their company's issues
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
        WHERE ps.company_id = ${user.companyId}
        ORDER BY ps.updated_at DESC, ps.created_at DESC
      `
    } else {
      // Admin, Ensuredit, etc. can see all issues
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
        ORDER BY ps.updated_at DESC, ps.created_at DESC
      `
    }

    console.log("Raw query results count:", issues.length)
    console.log("First result sample:", issues[0])

    return NextResponse.json(issues)
  } catch (error) {
    console.error("Project Status GET error:", error)
    console.error("Error details:", error.message)
    return NextResponse.json({ 
      error: "Failed to fetch project status items",
      details: error.message 
    }, { status: 500 })
  }
}

// POST - Create new project status item
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    if (!["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      integration_project_id,
      company_id,
      insurer_id,
      title,
      description,
      issue_category,
      sub_category,
      priority,
      status,
      assigned_to_id,
      assigned_to_name,
      pending_with_id,
      pending_with_name,
      due_date,
      resolution_type,
      followup_notes,
      raised_date,
    } = body

    if (!company_id || !title || !description) {
      return NextResponse.json({ error: "Company, title, and description are required" }, { status: 400 })
    }

    // Verify user has access to this company/project
    if (user.role === "Customer") {
      if (company_id !== user.companyId) {
        return NextResponse.json({ error: "Access denied to this company" }, { status: 403 })
      }
    }

    // Convert empty strings to null for UUID fields
    const insurerId = insurer_id || null
    const assignedToId = assigned_to_id || null
    const pendingWithId = pending_with_id || null

    // Handle optional fields, converting empty strings to null
    const dueDate = due_date || null
    const subCategory = sub_category || null
    const resolutionType = resolution_type || null
    const followupNotes = followup_notes || null

    try {
      const [newIssue] = await sql`
        INSERT INTO project_issues (
          integration_project_id, company_id, insurer_id, title, description, 
          issue_category, sub_category, priority, status,
          assigned_to_id, assigned_to_name, pending_with_id, pending_with_name,
          due_date, resolution_type, followup_notes, raised_date,
          raised_by_id, raised_by_name
        ) VALUES (
          ${integration_project_id}, ${company_id}, ${insurerId}, ${title}, ${description}, 
          ${issue_category || "Insurer Integration"}, ${subCategory}, ${priority || "Medium"}, ${status || "Raised"},
          ${assignedToId}, ${assigned_to_name}, ${pendingWithId}, ${pending_with_name},
          ${dueDate}, ${resolutionType}, ${followupNotes}, ${raised_date || new Date().toISOString().split("T")[0]},
          ${user.userId}, ${user.name}
        )
        RETURNING *
      `

      return NextResponse.json(newIssue, { status: 201 })
    } catch (dbError: any) {
      console.error("Database error creating project issue:", dbError)
      return NextResponse.json(
        { error: "Failed to create project status item due to a database error", details: dbError.message },
        { status: 500 },
      )
    }
  } catch (error: any) {
    console.error("Project Status POST error:", error)
    return NextResponse.json({ error: "Failed to create project status item", details: error.message }, { status: 500 })
  }
}

// PUT - Update project status item
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    if (!["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      id,
      integration_project_id,
      company_id,
      insurer_id,
      title,
      description,
      issue_category,
      sub_category,
      priority,
      status,
      assigned_to_id,
      assigned_to_name,
      pending_with_id,
      pending_with_name,
      due_date,
      resolution_type,
      followup_notes,
      raised_date,
      resolved_at,
    } = body

    // Convert empty strings to null for UUID fields
    const insurerId = insurer_id || null
    const assignedToId = assigned_to_id || null
    const pendingWithId = pending_with_id || null

    // Handle optional fields, converting empty strings to null
    const dueDate = due_date || null
    const subCategory = sub_category || null
    const resolutionType = resolution_type || null
    const followupNotes = followup_notes || null

    // Auto-set resolved_at when status changes to 'Resolved'
    const resolvedAtValue = status === "Resolved" ? new Date().toISOString() : resolved_at

    // Role-based restrictions for customers
    if (user.role === "Customer") {
      try {
        const [updatedIssue] = await sql`
          UPDATE project_issues 
          SET 
            integration_project_id = ${integration_project_id},
            company_id = ${company_id},
            insurer_id = ${insurerId},
            title = ${title},
            description = ${description},
            issue_category = ${issue_category},
            sub_category = ${subCategory},
            priority = ${priority},
            status = ${status},
            assigned_to_id = ${assignedToId},
            assigned_to_name = ${assigned_to_name},
            pending_with_id = ${pendingWithId},
            pending_with_name = ${pending_with_name},
            due_date = ${dueDate},
            resolution_type = ${resolutionType},
            followup_notes = ${followupNotes},
            raised_date = ${raised_date},
            resolved_at = ${resolvedAtValue},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND company_id = ${user.companyId}
          RETURNING *
        `
        return NextResponse.json(updatedIssue)
      } catch (dbError: any) {
        console.error("Database error updating project issue for customer:", dbError)
        return NextResponse.json(
          { error: "Failed to update project status item due to a database error", details: dbError.message },
          { status: 500 },
        )
      }
    } else {
      try {
        const [updatedIssue] = await sql`
          UPDATE project_issues 
          SET 
            integration_project_id = ${integration_project_id},
            company_id = ${company_id},
            insurer_id = ${insurerId},
            title = ${title},
            description = ${description},
            issue_category = ${issue_category},
            sub_category = ${subCategory},
            priority = ${priority},
            status = ${status},
            assigned_to_id = ${assignedToId},
            assigned_to_name = ${assigned_to_name},
            pending_with_id = ${pendingWithId},
            pending_with_name = ${pending_with_name},
            due_date = ${dueDate},
            resolution_type = ${resolutionType},
            followup_notes = ${followupNotes},
            raised_date = ${raised_date},
            resolved_at = ${resolvedAtValue},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `
        return NextResponse.json(updatedIssue)
      } catch (dbError: any) {
        console.error("Database error updating project issue for admin:", dbError)
        return NextResponse.json(
          { error: "Failed to update project status item due to a database error", details: dbError.message },
          { status: 500 },
        )
      }
    }
  } catch (error: any) {
    console.error("Project Status PUT error:", error)
    return NextResponse.json({ error: "Failed to update project status item", details: error.message }, { status: 500 })
  }
}

// DELETE - Delete project status item
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Project Status ID is required" }, { status: 400 })
    }

    try {
      await sql`
        DELETE FROM project_issues 
        WHERE id = ${id}
      `

      return NextResponse.json({ success: true })
    } catch (dbError: any) {
      console.error("Database error deleting project issue:", dbError)
      return NextResponse.json(
        { error: "Failed to delete project status item due to a database error", details: dbError.message },
        { status: 500 },
      )
    }
  } catch (error: any) {
    console.error("Project Status DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete project status item", details: error.message }, { status: 500 })
  }
}
