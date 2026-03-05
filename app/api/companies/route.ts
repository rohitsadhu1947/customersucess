import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { getPaginationParams, paginatedResponse } from "@/lib/pagination"
import { createCompanySchema, updateCompanySchema, validateBody } from "@/lib/validations"
import { logAudit } from "@/lib/audit"

// GET - Fetch companies with user counts
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth()

    const { searchParams } = new URL(request.url)
    const usePagination = searchParams.has("page")

    let companies

    if (user.role === "Customer" || user.role === "Customer View Only") {
      if (usePagination) {
        const params = getPaginationParams(request)
        const [{ count: total }] = await sql`
          SELECT COUNT(*) as count FROM companies WHERE id = ${user.companyId} AND (is_deleted = false OR is_deleted IS NULL)
        `
        companies = await sql`
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
          WHERE c.id = ${user.companyId}
            AND (c.is_deleted = false OR c.is_deleted IS NULL)
          ORDER BY c.name ASC
          LIMIT ${params.limit} OFFSET ${params.offset}
        `
        return NextResponse.json(paginatedResponse(companies, Number(total), params))
      } else {
        companies = await sql`
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
          WHERE c.id = ${user.companyId}
            AND (c.is_deleted = false OR c.is_deleted IS NULL)
          ORDER BY c.name ASC
        `
      }
    } else {
      if (usePagination) {
        const params = getPaginationParams(request)
        const [{ count: total }] = await sql`
          SELECT COUNT(*) as count FROM companies WHERE (is_deleted = false OR is_deleted IS NULL)
        `
        companies = await sql`
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
          WHERE (c.is_deleted = false OR c.is_deleted IS NULL)
          ORDER BY c.name ASC
          LIMIT ${params.limit} OFFSET ${params.offset}
        `
        return NextResponse.json(paginatedResponse(companies, Number(total), params))
      } else {
        companies = await sql`
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
          WHERE (c.is_deleted = false OR c.is_deleted IS NULL)
          ORDER BY c.name ASC
        `
      }
    }

    return NextResponse.json(companies)
  } catch (error) {
    console.error("Companies GET error:", error)
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 })
  }
}

// POST - Create company
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (!["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validation = validateBody(createCompanySchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const {
      name,
      ensuredit_lead_name,
      client_lead_name,
      client_lead_email,
      customer_since,
      status,
      notes,
    } = validation.data

    // Check for duplicate names
    const existing = await sql`
      SELECT id FROM companies WHERE name = ${name}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Company with this name already exists" }, { status: 400 })
    }

    const newCompanies = await sql`
      INSERT INTO companies (
        name,
        ensuredit_lead_name,
        client_lead_name,
        client_lead_email,
        customer_since,
        status,
        notes
      ) VALUES (
        ${name},
        ${ensuredit_lead_name?.trim() || null},
        ${client_lead_name?.trim() || null},
        ${client_lead_email?.trim() || null},
        ${customer_since || null},
        ${status},
        ${notes?.trim() || null}
      )
      RETURNING *
    `

    await logAudit({ userId: user.userId, action: "create", entityType: "company", entityId: newCompanies[0].id, details: { name } })

    return NextResponse.json(newCompanies[0], { status: 201 })
  } catch (error) {
    console.error("Companies POST error:", error)
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 })
  }
}

// PUT - Update company
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (!["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 })
    }

    const body = await request.json()
    const validation = validateBody(updateCompanySchema, { ...body, id })
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { name, ensuredit_lead_name, client_lead_name, client_lead_email, customer_since, status, notes } = validation.data

    // Check for duplicate names (excluding current)
    const existing = await sql`
      SELECT id FROM companies WHERE name = ${name} AND id != ${id}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Company with this name already exists" }, { status: 400 })
    }

    const updatedCompanies = await sql`
      UPDATE companies
      SET
        name = ${name},
        ensuredit_lead_name = ${ensuredit_lead_name?.trim() || null},
        client_lead_name = ${client_lead_name?.trim() || null},
        client_lead_email = ${client_lead_email?.trim() || null},
        customer_since = ${customer_since || null},
        status = ${status || "Active"},
        notes = ${notes?.trim() || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    if (updatedCompanies.length === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    await logAudit({ userId: user.userId, action: "update", entityType: "company", entityId: id })

    return NextResponse.json(updatedCompanies[0])
  } catch (error) {
    console.error("Companies PUT error:", error)
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 })
  }
}

// DELETE - Delete company
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 })
    }

    // Check for users
    const users = await sql`
      SELECT COUNT(*) as count FROM users WHERE company_id = ${id}
    `

    if (Number.parseInt(users[0].count) > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete company with existing users",
        },
        { status: 400 },
      )
    }

    // Check for projects
    const projects = await sql`
      SELECT COUNT(*) as count FROM integration_projects WHERE company_id = ${id}
    `

    if (Number.parseInt(projects[0].count) > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete company with existing projects",
        },
        { status: 400 },
      )
    }

    await sql`UPDATE companies SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`

    await logAudit({ userId: user.userId, action: "delete", entityType: "company", entityId: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Companies DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 })
  }
}
