import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    // Verify access to the issue
    if (user.role === "Customer" || user.role === "Customer View Only") {
      const [issue] = await sql`
        SELECT id FROM project_issues WHERE id = ${id} AND company_id = ${user.companyId}
      `
      if (!issue) {
        return NextResponse.json({ error: "Issue not found" }, { status: 404 })
      }
    }

    const history = await sql`
      SELECT * FROM issue_history
      WHERE issue_id = ${id}
      ORDER BY created_at DESC
    `

    return NextResponse.json(history)
  } catch (error) {
    console.error("History GET error:", error)
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
  }
}
