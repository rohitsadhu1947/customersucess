import { sql } from "@/lib/db"

export type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "password_reset"

export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  details,
}: {
  userId: string
  action: AuditAction
  entityType: string
  entityId?: string
  details?: Record<string, any>
}) {
  try {
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (${userId}, ${action}, ${entityType}, ${entityId || null}, ${JSON.stringify(details || {})})
    `
  } catch {
    // Silently fail - audit logging should never break the main operation
    // The audit_logs table may not exist yet
  }
}
