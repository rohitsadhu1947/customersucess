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

// GET - Fetch all integration projects with related data
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("company_id")
    const status = searchParams.get("status")

    let projects

    // Build query based on role and filters
    if (user.role === "Customer" || user.role === "Customer View Only") {
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
          ORDER BY ip.updated_at DESC, ip.created_at DESC
        `
      }
    } else {
      // Admin, Ensuredit, etc. can see all projects with optional filters
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
          ORDER BY ip.updated_at DESC, ip.created_at DESC
        `
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
    const user = await verifyAuth(request)

    if (!["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      company_id,
      product_id,
      sub_product_id,
      insurer_id,
      status,
      priority,
      api_kit_received,
      api_kit_received_date,
      creds_verified,
      creds_verification_date,
      dev_required,
      dev_start_date,
      dev_end_date,
      dev_estimated_hours,
      internal_testing_start_date,
      internal_testing_end_date,
      insurer_uat_creds_received,
      insurer_uat_start_date,
      insurer_uat_end_date,
      prod_creds_received,
      prod_cred_receipt_date,
      go_live_date,
      go_live_planned_date,
      current_blockers,
      technical_notes,
      business_notes,
    } = body

    if (!company_id || !product_id || !sub_product_id || !insurer_id) {
      return NextResponse.json(
        {
          error: "Company, Product, Sub-Product, and Insurer are required",
        },
        { status: 400 },
      )
    }

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
        ${company_id}, ${product_id}, ${sub_product_id}, ${insurer_id}, ${status || "Not Started"},
        ${priority || "Medium"}, ${api_kit_received || false}, ${api_kit_received_date},
        ${creds_verified || false}, ${creds_verification_date}, ${dev_required || true},
        ${dev_start_date}, ${dev_end_date}, ${dev_estimated_hours},
        ${internal_testing_start_date}, ${internal_testing_end_date},
        ${insurer_uat_creds_received || false}, ${insurer_uat_start_date}, ${insurer_uat_end_date},
        ${prod_creds_received || false}, ${prod_cred_receipt_date},
        ${go_live_date}, ${go_live_planned_date},
        ${current_blockers}, ${technical_notes}, ${business_notes},
        ${user.userId}
      )
      RETURNING *
    `

    return NextResponse.json(newProject, { status: 201 })
  } catch (error) {
    console.error("Integration projects POST error:", error)
    return NextResponse.json({ error: "Failed to create integration project" }, { status: 500 })
  }
}

// PUT - Update integration project
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    if (!["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      id,
      company_id,
      product_id,
      sub_product_id,
      insurer_id,
      status,
      priority,
      api_kit_received,
      api_kit_received_date,
      creds_verified,
      creds_verification_date,
      dev_required,
      dev_start_date,
      dev_end_date,
      dev_estimated_hours,
      internal_testing_start_date,
      internal_testing_end_date,
      insurer_uat_creds_received,
      insurer_uat_start_date,
      insurer_uat_end_date,
      prod_creds_received,
      prod_cred_receipt_date,
      go_live_date,
      go_live_planned_date,
      current_blockers,
      technical_notes,
      business_notes,
    } = body

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
          api_kit_received = ${api_kit_received},
          api_kit_received_date = ${api_kit_received_date},
          creds_verified = ${creds_verified},
          creds_verification_date = ${creds_verification_date},
          dev_required = ${dev_required},
          dev_start_date = ${dev_start_date},
          dev_end_date = ${dev_end_date},
          dev_estimated_hours = ${dev_estimated_hours},
          internal_testing_start_date = ${internal_testing_start_date},
          internal_testing_end_date = ${internal_testing_end_date},
          insurer_uat_creds_received = ${insurer_uat_creds_received},
          insurer_uat_start_date = ${insurer_uat_start_date},
          insurer_uat_end_date = ${insurer_uat_end_date},
          prod_creds_received = ${prod_creds_received},
          prod_cred_receipt_date = ${prod_cred_receipt_date},
          go_live_date = ${go_live_date},
          go_live_planned_date = ${go_live_planned_date},
          current_blockers = ${current_blockers},
          technical_notes = ${technical_notes},
          business_notes = ${business_notes},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND company_id = ${user.companyId}
        RETURNING *
      `
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
          api_kit_received = ${api_kit_received},
          api_kit_received_date = ${api_kit_received_date},
          creds_verified = ${creds_verified},
          creds_verification_date = ${creds_verification_date},
          dev_required = ${dev_required},
          dev_start_date = ${dev_start_date},
          dev_end_date = ${dev_end_date},
          dev_estimated_hours = ${dev_estimated_hours},
          internal_testing_start_date = ${internal_testing_start_date},
          internal_testing_end_date = ${internal_testing_end_date},
          insurer_uat_creds_received = ${insurer_uat_creds_received},
          insurer_uat_start_date = ${insurer_uat_start_date},
          insurer_uat_end_date = ${insurer_uat_end_date},
          prod_creds_received = ${prod_creds_received},
          prod_cred_receipt_date = ${prod_cred_receipt_date},
          go_live_date = ${go_live_date},
          go_live_planned_date = ${go_live_planned_date},
          current_blockers = ${current_blockers},
          technical_notes = ${technical_notes},
          business_notes = ${business_notes},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `
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
    const user = await verifyAuth(request)

    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    await sql`
      DELETE FROM integration_projects 
      WHERE id = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Integration projects DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete integration project" }, { status: 500 })
  }
}
