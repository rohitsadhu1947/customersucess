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

// GET - Fetch all sub-products with parent product info
export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request)

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get("product_id")

    let query
    if (productId) {
      query = sql`
        SELECT 
          sp.id, sp.name, sp.code, sp.display_name, sp.description,
          sp.category, sp.sub_category, sp.min_premium_amount, sp.max_premium_amount,
          sp.min_sum_insured, sp.max_sum_insured, sp.requires_kyc, 
          sp.requires_medical_checkup, sp.instant_approval_available,
          sp.max_policy_term_years, sp.complexity_score, sp.estimated_dev_hours,
          sp.requires_custom_integration, sp.is_active, sp.launch_date,
          sp.sort_order, sp.created_at, sp.updated_at,
          p.name as product_name, p.code as product_code
        FROM sub_products sp
        LEFT JOIN products p ON sp.product_id = p.id
        WHERE sp.product_id = ${productId} AND sp.is_active = true
        ORDER BY sp.sort_order ASC, sp.name ASC
      `
    } else {
      query = sql`
        SELECT 
          sp.id, sp.name, sp.code, sp.display_name, sp.description,
          sp.category, sp.sub_category, sp.min_premium_amount, sp.max_premium_amount,
          sp.min_sum_insured, sp.max_sum_insured, sp.requires_kyc, 
          sp.requires_medical_checkup, sp.instant_approval_available,
          sp.max_policy_term_years, sp.complexity_score, sp.estimated_dev_hours,
          sp.requires_custom_integration, sp.is_active, sp.launch_date,
          sp.sort_order, sp.created_at, sp.updated_at,
          p.name as product_name, p.code as product_code
        FROM sub_products sp
        LEFT JOIN products p ON sp.product_id = p.id
        WHERE sp.is_active = true
        ORDER BY p.name ASC, sp.sort_order ASC, sp.name ASC
      `
    }

    const subProducts = await query

    return NextResponse.json(subProducts)
  } catch (error) {
    console.error("Sub-products GET error:", error)
    return NextResponse.json({ error: "Failed to fetch sub-products" }, { status: 500 })
  }
}

// POST - Create new sub-product
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    if (!["Admin", "Ensuredit"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      product_id,
      name,
      code,
      display_name,
      description,
      category,
      sub_category,
      min_premium_amount,
      max_premium_amount,
      min_sum_insured,
      max_sum_insured,
      requires_kyc,
      requires_medical_checkup,
      instant_approval_available,
      max_policy_term_years,
      complexity_score,
      estimated_dev_hours,
      requires_custom_integration,
      is_active,
      launch_date,
      sort_order,
    } = body

    if (!product_id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 })
    }

    const [newSubProduct] = await sql`
      INSERT INTO sub_products (
        product_id, name, code, display_name, description, category, sub_category,
        min_premium_amount, max_premium_amount, min_sum_insured, max_sum_insured,
        requires_kyc, requires_medical_checkup, instant_approval_available,
        max_policy_term_years, complexity_score, estimated_dev_hours,
        requires_custom_integration, is_active, launch_date, sort_order
      ) VALUES (
        ${product_id}, ${name}, ${code}, ${display_name}, ${description}, ${category}, ${sub_category},
        ${min_premium_amount}, ${max_premium_amount}, ${min_sum_insured}, ${max_sum_insured},
        ${requires_kyc || true}, ${requires_medical_checkup || false}, ${instant_approval_available || false},
        ${max_policy_term_years}, ${complexity_score || 1}, ${estimated_dev_hours},
        ${requires_custom_integration || false}, ${is_active || true}, ${launch_date}, ${sort_order || 0}
      )
      RETURNING *
    `

    return NextResponse.json(newSubProduct, { status: 201 })
  } catch (error) {
    console.error("Sub-products POST error:", error)
    return NextResponse.json({ error: "Failed to create sub-product" }, { status: 500 })
  }
}

// PUT - Update sub-product
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    if (!["Admin", "Ensuredit"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      id,
      product_id,
      name,
      code,
      display_name,
      description,
      category,
      sub_category,
      min_premium_amount,
      max_premium_amount,
      min_sum_insured,
      max_sum_insured,
      requires_kyc,
      requires_medical_checkup,
      instant_approval_available,
      max_policy_term_years,
      complexity_score,
      estimated_dev_hours,
      requires_custom_integration,
      is_active,
      launch_date,
      sort_order,
    } = body

    const [updatedSubProduct] = await sql`
      UPDATE sub_products 
      SET 
        product_id = ${product_id},
        name = ${name},
        code = ${code},
        display_name = ${display_name},
        description = ${description},
        category = ${category},
        sub_category = ${sub_category},
        min_premium_amount = ${min_premium_amount},
        max_premium_amount = ${max_premium_amount},
        min_sum_insured = ${min_sum_insured},
        max_sum_insured = ${max_sum_insured},
        requires_kyc = ${requires_kyc},
        requires_medical_checkup = ${requires_medical_checkup},
        instant_approval_available = ${instant_approval_available},
        max_policy_term_years = ${max_policy_term_years},
        complexity_score = ${complexity_score},
        estimated_dev_hours = ${estimated_dev_hours},
        requires_custom_integration = ${requires_custom_integration},
        is_active = ${is_active},
        launch_date = ${launch_date},
        sort_order = ${sort_order},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json(updatedSubProduct)
  } catch (error) {
    console.error("Sub-products PUT error:", error)
    return NextResponse.json({ error: "Failed to update sub-product" }, { status: 500 })
  }
}

// DELETE - Delete sub-product
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Sub-product ID is required" }, { status: 400 })
    }

    // Check if sub-product is used in any integration projects
    const [usage] = await sql`
      SELECT COUNT(*) as count 
      FROM integration_projects 
      WHERE sub_product_id = ${id}
    `

    if (Number.parseInt(usage.count) > 0) {
      return NextResponse.json(
        { error: "Cannot delete sub-product. It is being used in integration projects." },
        { status: 400 },
      )
    }

    // Soft delete - set is_active to false
    await sql`
      UPDATE sub_products 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Sub-products DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete sub-product" }, { status: 500 })
  }
}
