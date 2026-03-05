import { sql } from "@/lib/db"

export async function createNotification({
  userId,
  type,
  title,
  message,
  entityType,
  entityId,
}: {
  userId: string
  type: string
  title: string
  message?: string
  entityType?: string
  entityId?: string
}) {
  try {
    await sql`
      INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
      VALUES (${userId}, ${type}, ${title}, ${message || ""}, ${entityType || ""}, ${entityId || null})
    `
  } catch {
    // Silently fail -- notifications should never break main operations
  }
}

export async function notifyEnsureditTeam(
  title: string,
  message: string,
  entityType: string,
  entityId: string,
  excludeUserId?: string,
) {
  try {
    const ensureditUsers = await sql`
      SELECT id FROM users
      WHERE role_type IN ('Admin', 'Ensuredit', 'Ensuredit Client Lead')
        AND is_active = true
    `
    for (const u of ensureditUsers) {
      if (excludeUserId && u.id === excludeUserId) continue
      await createNotification({
        userId: u.id,
        type: "ticket",
        title,
        message,
        entityType,
        entityId,
      })
    }
  } catch {
    // Silently fail
  }
}
