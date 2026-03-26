import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

// GET - List insurer integration plans (optionally filter by insurer_id)
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth()
    const { searchParams } = new URL(request.url)
    const insurerId = searchParams.get("insurer_id")

    let plans
    if (insurerId) {
      plans = await sql`
        SELECT
          iip.*,
          i.name as insurer_name, i.short_name as insurer_short_name, i.code as insurer_code,
          p.name as product_name, p.display_name as product_display_name, p.code as product_code,
          sp.name as sub_product_name, sp.display_name as sub_product_display_name, sp.code as sub_product_code
        FROM insurer_integration_plans iip
        LEFT JOIN insurers i ON iip.insurer_id = i.id
        LEFT JOIN products p ON iip.product_id = p.id
        LEFT JOIN sub_products sp ON iip.sub_product_id = sp.id
        WHERE iip.insurer_id = ${insurerId} AND iip.is_deleted = false
        ORDER BY p.name, sp.name
      `
    } else {
      plans = await sql`
        SELECT
          iip.*,
          i.name as insurer_name, i.short_name as insurer_short_name, i.code as insurer_code,
          p.name as product_name, p.display_name as product_display_name, p.code as product_code,
          sp.name as sub_product_name, sp.display_name as sub_product_display_name, sp.code as sub_product_code
        FROM insurer_integration_plans iip
        LEFT JOIN insurers i ON iip.insurer_id = i.id
        LEFT JOIN products p ON iip.product_id = p.id
        LEFT JOIN sub_products sp ON iip.sub_product_id = sp.id
        WHERE iip.is_deleted = false
        ORDER BY i.name, p.name, sp.name
      `
    }

    return NextResponse.json(plans)
  } catch (error) {
    console.error("Insurer plans GET error:", error)
    return NextResponse.json({ error: "Failed to fetch insurer plans" }, { status: 500 })
  }
}

// POST - Create a new insurer integration plan
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth()
    if (!["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      insurer_id, product_id, sub_product_id,
      status, planned_date, development_start_date, uat_start_date, go_live_date,
      notes, api_version,
    } = body

    if (!insurer_id || !product_id) {
      return NextResponse.json({ error: "insurer_id and product_id are required" }, { status: 400 })
    }

    const [plan] = await sql`
      INSERT INTO insurer_integration_plans (
        insurer_id, product_id, sub_product_id,
        status, planned_date, development_start_date, uat_start_date, go_live_date,
        notes, api_version,
        created_by_id, created_by_name
      ) VALUES (
        ${insurer_id}, ${product_id}, ${sub_product_id || null},
        ${status || "Planned"}, ${planned_date || null}, ${development_start_date || null},
        ${uat_start_date || null}, ${go_live_date || null},
        ${notes || null}, ${api_version || null},
        ${user.userId}, ${user.name}
      )
      RETURNING *
    `

    return NextResponse.json(plan, { status: 201 })
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "This plan already exists for this insurer" }, { status: 409 })
    }
    console.error("Insurer plans POST error:", error)
    return NextResponse.json({ error: "Failed to create insurer plan" }, { status: 500 })
  }
}
