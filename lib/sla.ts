// SLA configuration and helpers for the ticketing module

export const SLA_RESPONSE_HOURS: Record<string, number> = {
  Critical: 1,
  High: 4,
  Medium: 24,
  Low: 48,
}

export const SLA_RESOLUTION_HOURS: Record<string, number> = {
  Critical: 4,
  High: 24,
  Medium: 72,
  Low: 168, // 1 week
}

export function calculateDueDate(priority: string, createdAt: Date = new Date()): Date {
  const hours = SLA_RESOLUTION_HOURS[priority] || 72
  const due = new Date(createdAt)
  due.setHours(due.getHours() + hours)
  return due
}

export function getSlaStatus(
  priority: string,
  createdAt: string,
  firstResponseAt: string | null,
  resolvedAt: string | null,
  dueDate: string | null,
): "ok" | "warning" | "breached" {
  const now = new Date()
  const created = new Date(createdAt)

  // Check response SLA first
  if (!firstResponseAt && !resolvedAt) {
    const responseHours = SLA_RESPONSE_HOURS[priority] || 24
    const responseDeadline = new Date(created)
    responseDeadline.setHours(responseDeadline.getHours() + responseHours)
    if (now > responseDeadline) return "breached"
    // Warning at 75% of SLA time
    const warningTime = new Date(created)
    warningTime.setHours(warningTime.getHours() + responseHours * 0.75)
    if (now > warningTime) return "warning"
  }

  // Check resolution SLA
  if (!resolvedAt && dueDate) {
    const due = new Date(dueDate)
    if (now > due) return "breached"
    // Warning at 75% of remaining time
    const resolutionHours = SLA_RESOLUTION_HOURS[priority] || 72
    const warningBuffer = resolutionHours * 0.25
    const warningTime = new Date(due)
    warningTime.setHours(warningTime.getHours() - warningBuffer)
    if (now > warningTime) return "warning"
  }

  return "ok"
}

export function formatSlaTimeRemaining(dueDate: string | null, resolvedAt: string | null): string {
  if (resolvedAt || !dueDate) return ""
  const now = new Date()
  const due = new Date(dueDate)
  const diffMs = due.getTime() - now.getTime()

  if (diffMs <= 0) {
    const overMs = Math.abs(diffMs)
    const overHours = Math.floor(overMs / (1000 * 60 * 60))
    const overDays = Math.floor(overHours / 24)
    if (overDays > 0) return `${overDays}d overdue`
    return `${overHours}h overdue`
  }

  const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60))
  const daysLeft = Math.floor(hoursLeft / 24)
  if (daysLeft > 0) return `${daysLeft}d ${hoursLeft % 24}h remaining`
  return `${hoursLeft}h remaining`
}
