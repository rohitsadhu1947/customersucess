import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { createIntegrationProjectSchema, updateIntegrationProjectSchema, validateBody } from "@/lib/validations"
import { logAudit } from "@/lib/audit"
import { getPaginationParams, paginatedResponse } from "@/lib/pagination"

// GET - Fetch all integration projects with related data
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth()

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("company_id")
    const status = searchParams.get("status")
    const usePagination = searchParams.has("page")

    let projects

    // Build query based on role and filters
    if (user.role === "Customer" || user.role === "Customer View Only") {
      if (usePagination) {
        const params = getPaginationParams(request)
        let countResult
        if (status) {
          countResult = await sql`SELECT COUNT(*) as count FROM integration_projects WHERE company_id = ${user.companyId} AND status = ${status} AND (is_deleted = false OR is_deleted IS NULL)`
        } else {
          countResult = await sql`SELECT COUNT(*) as count FROM integration_projects WHERE company_id = ${user.companyId} AND (is_deleted = false OR is_deleted IS NULL)`
        }
        const total = countResult[0].count

        if (status) {
          projects = await sql`
            SELECT
              ip.*,
              c.name as company_name,
              p.name as product_name,
              p.display_name as product_display_name,
              p.code as product_code,
              sp.name as sub_product_name,
              sp.display_name as sub_product_display_name,
              sp.code as sub_product_code,
              sp.category as sub_product_category,
              sp.sub_category as sub_product_sub_category,
              i.name as insurer_name,
              i.short_name as insurer_short_name,
              i.code as insurer_code,
              u.name as created_by_name
            FROM integration_projects ip
            LEFT JOIN companies c ON ip.company_id = c.id
            LEFT JOIN products p ON ip.product_id = p.id
            LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            LEFT JOIN users u ON ip.created_by_id = u.id
            WHERE ip.company_id = ${user.companyId} AND ip.status = ${status}
              AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
            ORDER BY ip.updated_at DESC, ip.created_at DESC
            LIMIT ${params.limit} OFFSET ${params.offset}
          `
        } else {
          projects = await sql`
            SELECT
              ip.*,
              c.name as company_name,
              p.name as product_name,
              p.display_name as product_display_name,
              p.code as product_code,
              sp.name as sub_product_name,
              sp.display_name as sub_product_display_name,
              sp.code as sub_product_code,
              sp.category as sub_product_category,
              sp.sub_category as sub_product_sub_category,
              i.name as insurer_name,
              i.short_name as insurer_short_name,
              i.code as insurer_code,
              u.name as created_by_name
            FROM integration_projects ip
            LEFT JOIN companies c ON ip.company_id = c.id
            LEFT JOIN products p ON ip.product_id = p.id
            LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            LEFT JOIN users u ON ip.created_by_id = u.id
            WHERE ip.company_id = ${user.companyId}
              AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
            ORDER BY ip.updated_at DESC, ip.created_at DESC
            LIMIT ${params.limit} OFFSET ${params.offset}
          `
        }
        return NextResponse.json(paginatedResponse(projects, Number(total), params))
      } else {
        // Customer can only see their own company's projects
        if (status) {
          projects = await sql`
            SELECT
              ip.*,
              c.name as company_name,
              p.name as product_name,
              p.display_name as product_display_name,
              p.code as product_code,
              sp.name as sub_product_name,
              sp.display_name as sub_product_display_name,
              sp.code as sub_product_code,
              sp.category as sub_product_category,
              sp.sub_category as sub_product_sub_category,
              i.name as insurer_name,
              i.short_name as insurer_short_name,
              i.code as insurer_code,
              u.name as created_by_name
            FROM integration_projects ip
            LEFT JOIN companies c ON ip.company_id = c.id
            LEFT JOIN products p ON ip.product_id = p.id
            LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            LEFT JOIN users u ON ip.created_by_id = u.id
            WHERE ip.company_id = ${user.companyId} AND ip.status = ${status}
              AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
            ORDER BY ip.updated_at DESC, ip.created_at DESC
          `
        } else {
          projects = await sql`
            SELECT
              ip.*,
              c.name as company_name,
              p.name as product_name,
              p.display_name as product_display_name,
              p.code as product_code,
              sp.name as sub_product_name,
              sp.display_name as sub_product_display_name,
              sp.code as sub_product_code,
              sp.category as sub_product_category,
              sp.sub_category as sub_product_sub_category,
              i.name as insurer_name,
              i.short_name as insurer_short_name,
              i.code as insurer_code,
              u.name as created_by_name
            FROM integration_projects ip
            LEFT JOIN companies c ON ip.company_id = c.id
            LEFT JOIN products p ON ip.product_id = p.id
            LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            LEFT JOIN users u ON ip.created_by_id = u.id
            WHERE ip.company_id = ${user.companyId}
              AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
            ORDER BY ip.updated_at DESC, ip.created_at DESC
          `
        }
      }
    } else {
      // Admin, Ensuredit, etc. can see all projects with optional filters
      if (usePagination) {
        const params = getPaginationParams(request)
        let countResult
        if (companyId && status) {
          countResult = await sql`SELECT COUNT(*) as count FROM integration_projects WHERE company_id = ${companyId} AND status = ${status} AND (is_deleted = false OR is_deleted IS NULL)`
        } else if (companyId) {
          countResult = await sql`SELECT COUNT(*) as count FROM integration_projects WHERE company_id = ${companyId} AND (is_deleted = false OR is_deleted IS NULL)`
        } else if (status) {
          countResult = await sql`SELECT COUNT(*) as count FROM integration_projects WHERE status = ${status} AND (is_deleted = false OR is_deleted IS NULL)`
        } else {
          countResult = await sql`SELECT COUNT(*) as count FROM integration_projects WHERE (is_deleted = false OR is_deleted IS NULL)`
        }
        const total = countResult[0].count

        if (companyId && status) {
          projects = await sql`
            SELECT
              ip.*,
              c.name as company_name,
              p.name as product_name,
              p.display_name as product_display_name,
              p.code as product_code,
              sp.name as sub_product_name,
              sp.display_name as sub_product_display_name,
              sp.code as sub_product_code,
              sp.category as sub_product_category,
              sp.sub_category as sub_product_sub_category,
              i.name as insurer_name,
              i.short_name as insurer_short_name,
              i.code as insurer_code,
              u.name as created_by_name
            FROM integration_projects ip
            LEFT JOIN companies c ON ip.company_id = c.id
            LEFT JOIN products p ON ip.product_id = p.id
            LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            LEFT JOIN users u ON ip.created_by_id = u.id
            WHERE ip.company_id = ${companyId} AND ip.status = ${status}
              AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
            ORDER BY ip.updated_at DESC, ip.created_at DESC
            LIMIT ${params.limit} OFFSET ${params.offset}
          `
        } else if (companyId) {
          projects = await sql`
            SELECT
              ip.*,
              c.name as company_name,
              p.name as product_name,
              p.display_name as product_display_name,
              p.code as product_code,
              sp.name as sub_product_name,
              sp.display_name as sub_product_display_name,
              sp.code as sub_product_code,
              sp.category as sub_product_category,
              sp.sub_category as sub_product_sub_category,
              i.name as insurer_name,
              i.short_name as insurer_short_name,
              i.code as insurer_code,
              u.name as created_by_name
            FROM integration_projects ip
            LEFT JOIN companies c ON ip.company_id = c.id
            LEFT JOIN products p ON ip.product_id = p.id
            LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            LEFT JOIN users u ON ip.created_by_id = u.id
            WHERE ip.company_id = ${companyId}
              AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
            ORDER BY ip.updated_at DESC, ip.created_at DESC
            LIMIT ${params.limit} OFFSET ${params.offset}
          `
        } else if (status) {
          projects = await sql`
            SELECT
              ip.*,
              c.name as company_name,
              p.name as product_name,
              p.display_name as product_display_name,
              p.code as product_code,
              sp.name as sub_product_name,
              sp.display_name as sub_product_display_name,
              sp.code as sub_product_code,
              sp.category as sub_product_category,
              sp.sub_category as sub_product_sub_category,
              i.name as insurer_name,
              i.short_name as insurer_short_name,
              i.code as insurer_code,
              u.name as created_by_name
            FROM integration_projects ip
            LEFT JOIN companies c ON ip.company_id = c.id
            LEFT JOIN products p ON ip.product_id = p.id
            LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            LEFT JOIN users u ON ip.created_by_id = u.id
            WHERE ip.status = ${status}
              AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
            ORDER BY ip.updated_at DESC, ip.created_at DESC
            LIMIT ${params.limit} OFFSET ${params.offset}
          `
        } else {
          projects = await sql`
            SELECT
              ip.*,
              c.name as company_name,
              p.name as product_name,
              p.display_name as product_display_name,
              p.code as product_code,
              sp.name as sub_product_name,
              sp.display_name as sub_product_display_name,
              sp.code as sub_product_code,
              sp.category as sub_product_category,
              sp.sub_category as sub_product_sub_category,
              i.name as insurer_name,
              i.short_name as insurer_short_name,
              i.code as insurer_code,
              u.name as created_by_name
            FROM integration_projects ip
            LEFT JOIN companies c ON ip.company_id = c.id
            LEFT JOIN products p ON ip.product_id = p.id
            LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            LEFT JOIN users u ON ip.created_by_id = u.id
            WHERE (ip.is_deleted = false OR ip.is_deleted IS NULL)
            ORDER BY ip.updated_at DESC, ip.created_at DESC
            LIMIT ${params.limit} OFFSET ${params.offset}
          `
        }
        return NextResponse.json(paginatedResponse(projects, Number(total), params))
      } else {
        if (companyId && status) {
          projects = await sql`
            SELECT
              ip.*,
              c.name as company_name,
              p.name as product_name,
              p.display_name as product_display_name,
              p.code as product_code,
              sp.name as sub_product_name,
              sp.display_name as sub_product_display_name,
              sp.code as sub_product_code,
              sp.category as sub_product_category,
              sp.sub_category as sub_product_sub_category,
              i.name as insurer_name,
              i.short_name as insurer_short_name,
              i.code as insurer_code,
              u.name as created_by_name
            FROM integration_projects ip
            LEFT JOIN companies c ON ip.company_id = c.id
            LEFT JOIN products p ON ip.product_id = p.id
            LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            LEFT JOIN users u ON ip.created_by_id = u.id
            WHERE ip.company_id = ${companyId} AND ip.status = ${status}
              AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
            ORDER BY ip.updated_at DESC, ip.created_at DESC
          `
        } else if (companyId) {
          projects = await sql`
            SELECT
              ip.*,
              c.name as company_name,
              p.name as product_name,
              p.display_name as product_display_name,
              p.code as product_code,
              sp.name as sub_product_name,
              sp.display_name as sub_product_display_name,
              sp.code as sub_product_code,
              sp.category as sub_product_category,
              sp.sub_category as sub_product_sub_category,
              i.name as insurer_name,
              i.short_name as insurer_short_name,
              i.code as insurer_code,
              u.name as created_by_name
            FROM integration_projects ip
            LEFT JOIN companies c ON ip.company_id = c.id
            LEFT JOIN products p ON ip.product_id = p.id
            LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            LEFT JOIN users u ON ip.created_by_id = u.id
            WHERE ip.company_id = ${companyId}
              AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
            ORDER BY ip.updated_at DESC, ip.created_at DESC
          `
        } else if (status) {
          projects = await sql`
            SELECT
              ip.*,
              c.name as company_name,
              p.name as product_name,
              p.display_name as product_display_name,
              p.code as product_code,
              sp.name as sub_product_name,
              sp.display_name as sub_product_display_name,
              sp.code as sub_product_code,
              sp.category as sub_product_category,
              sp.sub_category as sub_product_sub_category,
              i.name as insurer_name,
              i.short_name as insurer_short_name,
              i.code as insurer_code,
              u.name as created_by_name
            FROM integration_projects ip
            LEFT JOIN companies c ON ip.company_id = c.id
            LEFT JOIN products p ON ip.product_id = p.id
            LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            LEFT JOIN users u ON ip.created_by_id = u.id
            WHERE ip.status = ${status}
              AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
            ORDER BY ip.updated_at DESC, ip.created_at DESC
          `
        } else {
          projects = await sql`
            SELECT
              ip.*,
              c.name as company_name,
              p.name as product_name,
              p.display_name as product_display_name,
              p.code as product_code,
              sp.name as sub_product_name,
              sp.display_name as sub_product_display_name,
              sp.code as sub_product_code,
              sp.category as sub_product_category,
              sp.sub_category as sub_product_sub_category,
              i.name as insurer_name,
              i.short_name as insurer_short_name,
              i.code as insurer_code,
              u.name as created_by_name
            FROM integration_projects ip
            LEFT JOIN companies c ON ip.company_id = c.id
            LEFT JOIN products p ON ip.product_id = p.id
            LEFT JOIN sub_products sp ON ip.sub_product_id = sp.id
            LEFT JOIN insurers i ON ip.insurer_id = i.id
            LEFT JOIN users u ON ip.created_by_id = u.id
            WHERE (ip.is_deleted = false OR ip.is_deleted IS NULL)
            ORDER BY ip.updated_at DESC, ip.created_at DESC
          `
        }
      }
    }

    return NextResponse.json(projects)
  } catch (error) {
    console.error("Integration projects GET error:", error)
    return NextResponse.json({ error: "Failed to fetch integration projects" }, { status: 500 })
  }
}

// POST - Create new integration project
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (!["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validation = validateBody(createIntegrationProjectSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const toNull = (val: any) => (val === "" || val === undefined ? null : val)
    const {
      company_id, product_id, sub_product_id, insurer_id,
      status, priority, api_kit_received,
      creds_verified, dev_required,
      insurer_uat_creds_received,
      prod_creds_received,
      current_blockers, technical_notes, business_notes,
    } = validation.data

    const api_kit_received_date = toNull(validation.data.api_kit_received_date)
    const creds_verification_date = toNull(validation.data.creds_verification_date)
    const dev_start_date = toNull(validation.data.dev_start_date)
    const dev_end_date = toNull(validation.data.dev_end_date)
    const dev_estimated_hours = toNull(validation.data.dev_estimated_hours)
    const internal_testing_start_date = toNull(validation.data.internal_testing_start_date)
    const internal_testing_end_date = toNull(validation.data.internal_testing_end_date)
    const insurer_uat_start_date = toNull(validation.data.insurer_uat_start_date)
    const insurer_uat_end_date = toNull(validation.data.insurer_uat_end_date)
    const prod_cred_receipt_date = toNull(validation.data.prod_cred_receipt_date)
    const go_live_date = toNull(validation.data.go_live_date)
    const go_live_planned_date = toNull(validation.data.go_live_planned_date)

    const [newProject] = await sql`
      INSERT INTO integration_projects (
        company_id, product_id, sub_product_id, insurer_id, status,
        priority, api_kit_received, api_kit_received_date,
        creds_verified, creds_verification_date, dev_required,
        dev_start_date, dev_end_date, dev_estimated_hours,
        internal_testing_start_date, internal_testing_end_date,
        insurer_uat_creds_received, insurer_uat_start_date, insurer_uat_end_date,
        prod_creds_received, prod_cred_receipt_date,
        go_live_date, go_live_planned_date,
        current_blockers, technical_notes, business_notes,
        created_by_id
      ) VALUES (
        ${company_id}, ${product_id}, ${sub_product_id}, ${insurer_id}, ${status},
        ${priority}, ${api_kit_received}, ${api_kit_received_date},
        ${creds_verified}, ${creds_verification_date}, ${dev_required},
        ${dev_start_date}, ${dev_end_date}, ${dev_estimated_hours},
        ${internal_testing_start_date}, ${internal_testing_end_date},
        ${insurer_uat_creds_received}, ${insurer_uat_start_date}, ${insurer_uat_end_date},
        ${prod_creds_received}, ${prod_cred_receipt_date},
        ${go_live_date}, ${go_live_planned_date},
        ${current_blockers}, ${technical_notes}, ${business_notes},
        ${user.userId}
      )
      RETURNING *
    `

    await logAudit({ userId: user.userId, action: "create", entityType: "integration_project", entityId: newProject.id })

    return NextResponse.json(newProject, { status: 201 })
  } catch (error) {
    console.error("Integration projects POST error:", error)
    return NextResponse.json({ error: "Failed to create integration project" }, { status: 500 })
  }
}

// PUT - Update integration project
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (!["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validation = validateBody(updateIntegrationProjectSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    // Convert empty strings to null for date fields so COALESCE works correctly
    const emptyToNull = (val: any) => (val === "" || val === undefined ? null : val)

    const {
      id, company_id, product_id, sub_product_id, insurer_id,
      status, priority, api_kit_received,
      creds_verified, dev_required,
      insurer_uat_creds_received,
      prod_creds_received,
      current_blockers, technical_notes, business_notes,
    } = validation.data

    const api_kit_received_date = emptyToNull(validation.data.api_kit_received_date)
    const creds_verification_date = emptyToNull(validation.data.creds_verification_date)
    const dev_start_date = emptyToNull(validation.data.dev_start_date)
    const dev_end_date = emptyToNull(validation.data.dev_end_date)
    const dev_estimated_hours = emptyToNull(validation.data.dev_estimated_hours)
    const internal_testing_start_date = emptyToNull(validation.data.internal_testing_start_date)
    const internal_testing_end_date = emptyToNull(validation.data.internal_testing_end_date)
    const insurer_uat_start_date = emptyToNull(validation.data.insurer_uat_start_date)
    const insurer_uat_end_date = emptyToNull(validation.data.insurer_uat_end_date)
    const prod_cred_receipt_date = emptyToNull(validation.data.prod_cred_receipt_date)
    const go_live_date = emptyToNull(validation.data.go_live_date)
    const go_live_planned_date = emptyToNull(validation.data.go_live_planned_date)

    // Role-based restrictions for customers
    if (user.role === "Customer") {
      const [updatedProject] = await sql`
        UPDATE integration_projects 
        SET 
          company_id = ${company_id},
          product_id = ${product_id},
          sub_product_id = ${sub_product_id},
          insurer_id = ${insurer_id},
          status = ${status},
          priority = ${priority},
          api_kit_received = COALESCE(${api_kit_received}, api_kit_received),
          api_kit_received_date = COALESCE(${api_kit_received_date}, api_kit_received_date),
          creds_verified = COALESCE(${creds_verified}, creds_verified),
          creds_verification_date = COALESCE(${creds_verification_date}, creds_verification_date),
          dev_required = COALESCE(${dev_required}, dev_required),
          dev_start_date = COALESCE(${dev_start_date}, dev_start_date),
          dev_end_date = COALESCE(${dev_end_date}, dev_end_date),
          dev_estimated_hours = COALESCE(${dev_estimated_hours}, dev_estimated_hours),
          internal_testing_start_date = COALESCE(${internal_testing_start_date}, internal_testing_start_date),
          internal_testing_end_date = COALESCE(${internal_testing_end_date}, internal_testing_end_date),
          insurer_uat_creds_received = COALESCE(${insurer_uat_creds_received}, insurer_uat_creds_received),
          insurer_uat_start_date = COALESCE(${insurer_uat_start_date}, insurer_uat_start_date),
          insurer_uat_end_date = COALESCE(${insurer_uat_end_date}, insurer_uat_end_date),
          prod_creds_received = COALESCE(${prod_creds_received}, prod_creds_received),
          prod_cred_receipt_date = COALESCE(${prod_cred_receipt_date}, prod_cred_receipt_date),
          go_live_date = COALESCE(${go_live_date}, go_live_date),
          go_live_planned_date = COALESCE(${go_live_planned_date}, go_live_planned_date),
          current_blockers = COALESCE(${current_blockers}, current_blockers),
          technical_notes = COALESCE(${technical_notes}, technical_notes),
          business_notes = COALESCE(${business_notes}, business_notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND company_id = ${user.companyId}
        RETURNING *
      `
      await logAudit({ userId: user.userId, action: "update", entityType: "integration_project", entityId: id })
      return NextResponse.json(updatedProject)
    } else {
      const [updatedProject] = await sql`
        UPDATE integration_projects 
        SET 
          company_id = ${company_id},
          product_id = ${product_id},
          sub_product_id = ${sub_product_id},
          insurer_id = ${insurer_id},
          status = ${status},
          priority = ${priority},
          api_kit_received = COALESCE(${api_kit_received}, api_kit_received),
          api_kit_received_date = COALESCE(${api_kit_received_date}, api_kit_received_date),
          creds_verified = COALESCE(${creds_verified}, creds_verified),
          creds_verification_date = COALESCE(${creds_verification_date}, creds_verification_date),
          dev_required = COALESCE(${dev_required}, dev_required),
          dev_start_date = COALESCE(${dev_start_date}, dev_start_date),
          dev_end_date = COALESCE(${dev_end_date}, dev_end_date),
          dev_estimated_hours = COALESCE(${dev_estimated_hours}, dev_estimated_hours),
          internal_testing_start_date = COALESCE(${internal_testing_start_date}, internal_testing_start_date),
          internal_testing_end_date = COALESCE(${internal_testing_end_date}, internal_testing_end_date),
          insurer_uat_creds_received = COALESCE(${insurer_uat_creds_received}, insurer_uat_creds_received),
          insurer_uat_start_date = COALESCE(${insurer_uat_start_date}, insurer_uat_start_date),
          insurer_uat_end_date = COALESCE(${insurer_uat_end_date}, insurer_uat_end_date),
          prod_creds_received = COALESCE(${prod_creds_received}, prod_creds_received),
          prod_cred_receipt_date = COALESCE(${prod_cred_receipt_date}, prod_cred_receipt_date),
          go_live_date = COALESCE(${go_live_date}, go_live_date),
          go_live_planned_date = COALESCE(${go_live_planned_date}, go_live_planned_date),
          current_blockers = COALESCE(${current_blockers}, current_blockers),
          technical_notes = COALESCE(${technical_notes}, technical_notes),
          business_notes = COALESCE(${business_notes}, business_notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `
      await logAudit({ userId: user.userId, action: "update", entityType: "integration_project", entityId: id })
      return NextResponse.json(updatedProject)
    }
  } catch (error) {
    console.error("Integration projects PUT error:", error)
    return NextResponse.json({ error: "Failed to update integration project" }, { status: 500 })
  }
}

// DELETE - Delete integration project
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    await sql`
      UPDATE integration_projects
      SET is_deleted = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `

    await logAudit({ userId: user.userId, action: "delete", entityType: "integration_project", entityId: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Integration projects DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete integration project" }, { status: 500 })
  }
}
