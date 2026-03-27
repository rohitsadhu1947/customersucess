import { createHash } from "crypto"

const EMAIL_REPLY_DOMAIN = process.env.EMAIL_REPLY_DOMAIN || "reply.ensuredit.com"
const EMAIL_FROM_DOMAIN = process.env.EMAIL_FROM_DOMAIN || "ensuredit.com"

/**
 * Encode a ticket ID into a short token for reply-to addresses.
 * Uses first 12 chars of UUID (unique enough for routing).
 */
export function encodeTicketRef(ticketId: string): string {
  return ticketId.replace(/-/g, "").slice(0, 12)
}

/**
 * Decode a ticket reference token back to a searchable prefix.
 */
export function decodeTicketRef(token: string): string {
  return token.slice(0, 12)
}

/**
 * Generate a reply-to address for a ticket.
 * e.g., ticket+a1b2c3d4e5f6@reply.ensuredit.com
 */
export function generateReplyToAddress(ticketId: string): string {
  const token = encodeTicketRef(ticketId)
  return `ticket+${token}@${EMAIL_REPLY_DOMAIN}`
}

/**
 * Extract ticket reference from an inbound reply-to address.
 * Returns the token or null if not a valid ticket reply address.
 */
export function extractTicketRefFromAddress(address: string): string | null {
  const match = address.match(/ticket\+([a-f0-9]{12})@/i)
  return match ? match[1] : null
}

/**
 * Extract ticket number from email subject line.
 * Looks for patterns like [TKT-202603-00042]
 */
export function extractTicketNumberFromSubject(subject: string): string | null {
  const match = subject.match(/\[(TKT-\d{6}-\d+)\]/i)
  return match ? match[1] : null
}

/**
 * Generate an RFC 2822 Message-ID for an outbound email.
 */
export function generateMessageId(emailId: string): string {
  return `<${emailId}@${EMAIL_FROM_DOMAIN}>`
}
