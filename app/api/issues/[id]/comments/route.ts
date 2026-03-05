import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { logAudit } from "@/lib/audit"

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

    let comments
    if (user.role === "Customer" || user.role === "Customer View Only") {
      // Customers don't see internal comments
      comments = await sql`
        SELECT * FROM issue_comments
        WHERE issue_id = ${id}
          AND (is_deleted = false OR is_deleted IS NULL)
          AND is_internal = false
        ORDER BY created_at ASC
      `
    } else {
      comments = await sql`
        SELECT * FROM issue_comments
        WHERE issue_id = ${id}
          AND (is_deleted = false OR is_deleted IS NULL)
        ORDER BY created_at ASC
      `
    }

    return NextResponse.json(comments)
  } catch (error) {
    console.error("Comments GET error:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    if (user.role === "Customer View Only") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify access to the issue
    if (user.role === "Customer") {
      const [issue] = await sql`
        SELECT id FROM project_issues WHERE id = ${id} AND company_id = ${user.companyId}
      `
      if (!issue) {
        return NextResponse.json({ error: "Issue not found" }, { status: 404 })
      }
    }

    const body = await request.json()
    const { comment, is_internal } = body

    if (!comment || !comment.trim()) {
      return NextResponse.json({ error: "Comment is required" }, { status: 400 })
    }

    // Customers cannot post internal comments
    const internal = user.role === "Customer" ? false : (is_internal || false)

    const [newComment] = await sql`
      INSERT INTO issue_comments (issue_id, user_id, user_name, comment, is_internal)
      VALUES (${id}, ${user.userId}, ${user.name}, ${comment.trim()}, ${internal})
      RETURNING *
    `

    await logAudit({
      userId: user.userId,
      action: "create",
      entityType: "issue_comment",
      entityId: String(newComment.id),
      details: { issue_id: id },
    })

    return NextResponse.json(newComment, { status: 201 })
  } catch (error) {
    console.error("Comments POST error:", error)
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 })
  }
}
