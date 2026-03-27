/**
 * Substitute {{variable_name}} placeholders in a template string.
 */
export function substituteVariables(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match
  })
}

/**
 * Build the standard variable context from ticket and user data.
 */
export function buildTemplateContext(params: {
  ticketNumber: string
  ticketCategory: string
  ticketPriority: string
  companyName: string
  senderName: string
  insurerContactName?: string
  customMessage?: string
}): Record<string, string> {
  return {
    ticket_number: params.ticketNumber,
    ticket_category: params.ticketCategory,
    ticket_priority: params.ticketPriority,
    company_name: params.companyName,
    sender_name: params.senderName,
    insurer_contact_name: params.insurerContactName || "Team",
    custom_message: params.customMessage || "",
  }
}
