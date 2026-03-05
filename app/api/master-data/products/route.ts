import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

// GET - Fetch all products with sub-products
export async function GET(request: NextRequest) {
  try {
    await verifyAuth()

    const products = await sql`
      SELECT 
        p.id, p.name, p.code, p.display_name, p.description,
        p.product_type, p.target_market, p.api_base_url,
        p.documentation_url, p.sandbox_url, p.pricing_model,
        p.base_price, p.currency, p.is_active, p.launch_date,
        p.created_at, p.updated_at,
        json_agg(
          json_build_object(
            'id', sp.id,
            'name', sp.name,
            'code', sp.code,
            'display_name', sp.display_name,
            'category', sp.category,
            'sub_category', sp.sub_category,
            'is_active', sp.is_active
          ) ORDER BY sp.sort_order, sp.name
        ) FILTER (WHERE sp.id IS NOT NULL) as sub_products
      FROM products p
      LEFT JOIN sub_products sp ON p.id = sp.product_id
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.code, p.display_name, p.description,
               p.product_type, p.target_market, p.api_base_url,
               p.documentation_url, p.sandbox_url, p.pricing_model,
               p.base_price, p.currency, p.is_active, p.launch_date,
               p.created_at, p.updated_at
      ORDER BY p.name ASC
    `

    return NextResponse.json(products)
  } catch (error) {
    console.error("Products GET error:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}

// POST - Create new product
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (!["Admin", "Ensuredit"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      code,
      display_name,
      description,
      product_type,
      target_market,
      api_base_url,
      documentation_url,
      sandbox_url,
      pricing_model,
      base_price,
      currency,
      is_active,
      launch_date,
    } = body

    const [newProduct] = await sql`
      INSERT INTO products (
        name, code, display_name, description, product_type, target_market,
        api_base_url, documentation_url, sandbox_url, pricing_model,
        base_price, currency, is_active, launch_date, created_by_id
      ) VALUES (
        ${name}, ${code}, ${display_name}, ${description}, ${product_type}, ${target_market},
        ${api_base_url}, ${documentation_url}, ${sandbox_url}, ${pricing_model},
        ${base_price}, ${currency || "INR"}, ${is_active || true}, ${launch_date}, ${user.userId}
      )
      RETURNING *
    `

    return NextResponse.json(newProduct, { status: 201 })
  } catch (error) {
    console.error("Products POST error:", error)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}

// PUT - Update product
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (!["Admin", "Ensuredit"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      id,
      name,
      code,
      display_name,
      description,
      product_type,
      target_market,
      api_base_url,
      documentation_url,
      sandbox_url,
      pricing_model,
      base_price,
      currency,
      is_active,
      launch_date,
    } = body

    const [updatedProduct] = await sql`
      UPDATE products 
      SET 
        name = ${name},
        code = ${code},
        display_name = ${display_name},
        description = ${description},
        product_type = ${product_type},
        target_market = ${target_market},
        api_base_url = ${api_base_url},
        documentation_url = ${documentation_url},
        sandbox_url = ${sandbox_url},
        pricing_model = ${pricing_model},
        base_price = ${base_price},
        currency = ${currency},
        is_active = ${is_active},
        launch_date = ${launch_date},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json(updatedProduct)
  } catch (error) {
    console.error("Products PUT error:", error)
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
  }
}

// DELETE - Delete product
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 })
    }

    // Check if product is used in any integration projects
    const [usage] = await sql`
      SELECT COUNT(*) as count 
      FROM integration_projects 
      WHERE product_id = ${id}
    `

    if (Number.parseInt(usage.count) > 0) {
      return NextResponse.json(
        { error: "Cannot delete product. It is being used in integration projects." },
        { status: 400 },
      )
    }

    // Soft delete - set is_active to false
    await sql`
      UPDATE products 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Products DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
  }
}
