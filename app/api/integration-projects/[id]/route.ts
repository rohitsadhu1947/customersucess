import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { updateIntegrationProjectSchema, validateBody } from "@/lib/validations"
import { logAudit } from "@/lib/audit"

// GET - Fetch single integration project by ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    let projects

    if (user.role === "Customer" || user.role === "Customer View Only") {
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
        WHERE ip.id = ${id} AND ip.company_id = ${user.companyId}
          AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
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
        WHERE ip.id = ${id}
          AND (ip.is_deleted = false OR ip.is_deleted IS NULL)
      `
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({ error: "Integration project not found" }, { status: 404 })
    }

    return NextResponse.json(projects[0])
  } catch (error) {
    console.error("Integration project GET error:", error)
    return NextResponse.json({ error: "Failed to fetch integration project" }, { status: 500 })
  }
}

// PUT - Update single integration project
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    if (!["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    body.id = id // Use URL param as the ID
    const validation = validateBody(updateIntegrationProjectSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const {
      company_id, product_id, sub_product_id, insurer_id,
      status, priority, api_kit_received, api_kit_received_date,
      creds_verified, creds_verification_date, dev_required,
      dev_start_date, dev_end_date, dev_estimated_hours,
      internal_testing_start_date, internal_testing_end_date,
      insurer_uat_creds_received, insurer_uat_start_date, insurer_uat_end_date,
      prod_creds_received, prod_cred_receipt_date,
      go_live_date, go_live_planned_date,
      current_blockers, technical_notes, business_notes,
    } = validation.data

    let updatedProject

    if (user.role === "Customer") {
      const result = await sql`
        UPDATE integration_projects SET
          company_id = COALESCE(${company_id}, company_id),
          product_id = COALESCE(${product_id}, product_id),
          sub_product_id = COALESCE(${sub_product_id}, sub_product_id),
          insurer_id = COALESCE(${insurer_id}, insurer_id),
          status = COALESCE(${status}, status),
          priority = COALESCE(${priority}, priority),
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
      updatedProject = result[0]
    } else {
      const result = await sql`
        UPDATE integration_projects SET
          company_id = COALESCE(${company_id}, company_id),
          product_id = COALESCE(${product_id}, product_id),
          sub_product_id = COALESCE(${sub_product_id}, sub_product_id),
          insurer_id = COALESCE(${insurer_id}, insurer_id),
          status = COALESCE(${status}, status),
          priority = COALESCE(${priority}, priority),
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
      updatedProject = result[0]
    }

    if (!updatedProject) {
      return NextResponse.json({ error: "Integration project not found" }, { status: 404 })
    }

    await logAudit({ userId: user.userId, action: "update", entityType: "integration_project", entityId: id })
    return NextResponse.json(updatedProject)
  } catch (error) {
    console.error("Integration project PUT error:", error)
    return NextResponse.json({ error: "Failed to update integration project" }, { status: 500 })
  }
}
