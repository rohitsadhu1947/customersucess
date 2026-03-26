import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

// PUT - Update an insurer integration plan
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    if (!["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      status, planned_date, development_start_date, uat_start_date, go_live_date,
      notes, api_version,
    } = body

    const [plan] = await sql`
      UPDATE insurer_integration_plans
      SET
        status = COALESCE(${status}, status),
        planned_date = COALESCE(${planned_date || null}, planned_date),
        development_start_date = COALESCE(${development_start_date || null}, development_start_date),
        uat_start_date = COALESCE(${uat_start_date || null}, uat_start_date),
        go_live_date = COALESCE(${go_live_date || null}, go_live_date),
        notes = COALESCE(${notes}, notes),
        api_version = COALESCE(${api_version}, api_version),
        updated_by_id = ${user.userId},
        updated_by_name = ${user.name},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND is_deleted = false
      RETURNING *
    `

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    return NextResponse.json(plan)
  } catch (error) {
    console.error("Insurer plans PUT error:", error)
    return NextResponse.json({ error: "Failed to update insurer plan" }, { status: 500 })
  }
}

// DELETE - Soft delete an insurer integration plan
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Only admins can delete plans" }, { status: 403 })
    }

    const { id } = await params

    await sql`
      UPDATE insurer_integration_plans
      SET is_deleted = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Insurer plans DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete insurer plan" }, { status: 500 })
  }
}
