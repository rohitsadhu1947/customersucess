import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

// GET - Fetch all insurers
export async function GET(request: NextRequest) {
  try {
    await verifyAuth()

    const insurers = await sql`
      SELECT 
        id, name, short_name, code, insurer_type, license_type,
        primary_contact_name, primary_contact_email, primary_contact_phone,
        technical_contact_name, technical_contact_email, technical_contact_phone,
        website_url, api_documentation_url, developer_portal_url,
        supports_api, api_version, authentication_method,
        status, onboarding_status, is_preferred_partner, partnership_tier,
        market_share_percentage, annual_premium_volume, customer_rating,
        claim_settlement_ratio, created_at, updated_at
      FROM insurers 
      ORDER BY name ASC
    `

    return NextResponse.json(insurers)
  } catch (error) {
    console.error("Insurers GET error:", error)
    return NextResponse.json({ error: "Failed to fetch insurers" }, { status: 500 })
  }
}

// POST - Create new insurer
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (!["Admin", "Ensuredit"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      short_name,
      code,
      insurer_type,
      license_type,
      primary_contact_name,
      primary_contact_email,
      primary_contact_phone,
      technical_contact_name,
      technical_contact_email,
      technical_contact_phone,
      website_url,
      api_documentation_url,
      developer_portal_url,
      supports_api,
      api_version,
      authentication_method,
      status,
      onboarding_status,
      is_preferred_partner,
      partnership_tier,
    } = body

    const [newInsurer] = await sql`
      INSERT INTO insurers (
        name, short_name, code, insurer_type, license_type,
        primary_contact_name, primary_contact_email, primary_contact_phone,
        technical_contact_name, technical_contact_email, technical_contact_phone,
        website_url, api_documentation_url, developer_portal_url,
        supports_api, api_version, authentication_method,
        status, onboarding_status, is_preferred_partner, partnership_tier,
        created_by_id
      ) VALUES (
        ${name}, ${short_name}, ${code}, ${insurer_type || "General"}, ${license_type || "Composite"},
        ${primary_contact_name}, ${primary_contact_email}, ${primary_contact_phone},
        ${technical_contact_name}, ${technical_contact_email}, ${technical_contact_phone},
        ${website_url}, ${api_documentation_url}, ${developer_portal_url},
        ${supports_api || false}, ${api_version}, ${authentication_method},
        ${status || "Active"}, ${onboarding_status || "Not Started"}, 
        ${is_preferred_partner || false}, ${partnership_tier || "Standard"},
        ${user.userId}
      )
      RETURNING *
    `

    return NextResponse.json(newInsurer, { status: 201 })
  } catch (error) {
    console.error("Insurers POST error:", error)
    return NextResponse.json({ error: "Failed to create insurer" }, { status: 500 })
  }
}

// PUT - Update insurer
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
      short_name,
      code,
      insurer_type,
      license_type,
      primary_contact_name,
      primary_contact_email,
      primary_contact_phone,
      technical_contact_name,
      technical_contact_email,
      technical_contact_phone,
      website_url,
      api_documentation_url,
      developer_portal_url,
      supports_api,
      api_version,
      authentication_method,
      status,
      onboarding_status,
      is_preferred_partner,
      partnership_tier,
    } = body

    const [updatedInsurer] = await sql`
      UPDATE insurers 
      SET 
        name = ${name},
        short_name = ${short_name},
        code = ${code},
        insurer_type = ${insurer_type},
        license_type = ${license_type},
        primary_contact_name = ${primary_contact_name},
        primary_contact_email = ${primary_contact_email},
        primary_contact_phone = ${primary_contact_phone},
        technical_contact_name = ${technical_contact_name},
        technical_contact_email = ${technical_contact_email},
        technical_contact_phone = ${technical_contact_phone},
        website_url = ${website_url},
        api_documentation_url = ${api_documentation_url},
        developer_portal_url = ${developer_portal_url},
        supports_api = ${supports_api},
        api_version = ${api_version},
        authentication_method = ${authentication_method},
        status = ${status},
        onboarding_status = ${onboarding_status},
        is_preferred_partner = ${is_preferred_partner},
        partnership_tier = ${partnership_tier},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json(updatedInsurer)
  } catch (error) {
    console.error("Insurers PUT error:", error)
    return NextResponse.json({ error: "Failed to update insurer" }, { status: 500 })
  }
}

// DELETE - Delete insurer
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Insurer ID is required" }, { status: 400 })
    }

    // Check if insurer is used in any integration projects
    const [usage] = await sql`
      SELECT COUNT(*) as count 
      FROM integration_projects 
      WHERE insurer_id = ${id}
    `

    if (Number.parseInt(usage.count) > 0) {
      return NextResponse.json(
        { error: "Cannot delete insurer. It is being used in integration projects." },
        { status: 400 },
      )
    }

    await sql`
      DELETE FROM insurers 
      WHERE id = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Insurers DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete insurer" }, { status: 500 })
  }
}
