import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

// GET - Fetch notifications for current user
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth()

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unread") === "true"
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))

    let notifications
    if (unreadOnly) {
      notifications = await sql`
        SELECT * FROM notifications
        WHERE user_id = ${user.userId} AND is_read = false
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else {
      notifications = await sql`
        SELECT * FROM notifications
        WHERE user_id = ${user.userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    }

    // Get unread count
    const [{ count }] = await sql`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ${user.userId} AND is_read = false
    `

    return NextResponse.json({ notifications, unreadCount: Number(count) })
  } catch (error) {
    console.error("Notifications GET error:", error)
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }
}

// PUT - Mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth()
    const body = await request.json()
    const { id, markAll } = body

    if (markAll) {
      await sql`
        UPDATE notifications SET is_read = true
        WHERE user_id = ${user.userId} AND is_read = false
      `
    } else if (id) {
      await sql`
        UPDATE notifications SET is_read = true
        WHERE id = ${id} AND user_id = ${user.userId}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Notifications PUT error:", error)
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 })
  }
}
