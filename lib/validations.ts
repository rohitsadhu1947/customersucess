import { z } from "zod"

// Issues
export const createIssueSchema = z.object({
  company_id: z.string().min(1, "Company is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  integration_project_id: z.string().nullable().optional(),
  insurer_id: z.string().nullable().optional(),
  issue_category: z.string().optional(),
  sub_category: z.string().nullable().optional(),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
  status: z.string().default("Raised"),
  assigned_to_id: z.string().nullable().optional(),
  assigned_to_name: z.string().nullable().optional(),
  pending_with_id: z.string().nullable().optional(),
  pending_with_name: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  resolution_type: z.string().nullable().optional(),
  followup_notes: z.string().nullable().optional(),
  raised_date: z.string().nullable().optional(),
})

export const updateIssueSchema = createIssueSchema.extend({
  id: z.string().min(1, "Issue ID is required"),
  resolved_at: z.string().nullable().optional(),
}).partial().required({ id: true })

// Companies
export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").transform(s => s.trim()),
  ensuredit_lead_name: z.string().nullable().optional(),
  client_lead_name: z.string().nullable().optional(),
  client_lead_email: z.string().email("Invalid email format").nullable().optional().or(z.literal("")),
  customer_since: z.string().nullable().optional(),
  status: z.enum(["Active", "Inactive", "Onboarding"]).default("Active"),
  notes: z.string().nullable().optional(),
})

export const updateCompanySchema = createCompanySchema.extend({
  id: z.string().min(1, "Company ID is required"),
}).partial().required({ id: true })

// Users
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role_type: z.enum(["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer", "Customer View Only"]),
  company_id: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  email_verified: z.boolean().default(false),
  two_factor_enabled: z.boolean().default(false),
})

export const updateUserSchema = createUserSchema.omit({ password: true }).extend({
  id: z.string().min(1, "User ID is required"),
  password: z.string().min(6).optional(),
}).partial().required({ id: true })

// Integration Projects
export const createIntegrationProjectSchema = z.object({
  company_id: z.string().min(1, "Company is required"),
  product_id: z.string().min(1, "Product is required"),
  sub_product_id: z.string().min(1, "Sub-product is required"),
  insurer_id: z.string().min(1, "Insurer is required"),
  status: z.string().default("Not Started"),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
  api_kit_received: z.boolean().default(false),
  api_kit_received_date: z.string().nullable().optional(),
  creds_verified: z.boolean().default(false),
  creds_verification_date: z.string().nullable().optional(),
  dev_required: z.boolean().default(true),
  dev_start_date: z.string().nullable().optional(),
  dev_end_date: z.string().nullable().optional(),
  dev_estimated_hours: z.number().nullable().optional(),
  internal_testing_start_date: z.string().nullable().optional(),
  internal_testing_end_date: z.string().nullable().optional(),
  insurer_uat_creds_received: z.boolean().default(false),
  insurer_uat_start_date: z.string().nullable().optional(),
  insurer_uat_end_date: z.string().nullable().optional(),
  prod_creds_received: z.boolean().default(false),
  prod_cred_receipt_date: z.string().nullable().optional(),
  go_live_date: z.string().nullable().optional(),
  go_live_planned_date: z.string().nullable().optional(),
  current_blockers: z.string().nullable().optional(),
  technical_notes: z.string().nullable().optional(),
  business_notes: z.string().nullable().optional(),
})

export const updateIntegrationProjectSchema = createIntegrationProjectSchema.extend({
  id: z.string().min(1, "Project ID is required"),
}).partial().required({ id: true })

// Integration Credentials
export const CREDENTIAL_ENVIRONMENTS = ["UAT", "Production"] as const

export const createCredentialSchema = z.object({
  environment: z.enum(["UAT", "Production"]),
  credential_token: z.string().nullable().optional(),
  credential_user_id: z.string().nullable().optional(),
  credential_password: z.string().nullable().optional(),
  additional_fields: z.record(z.string()).optional().default({}),
  notes: z.string().nullable().optional(),
})

export const updateCredentialSchema = createCredentialSchema.extend({
  id: z.string().min(1, "Credential ID is required"),
}).partial().required({ id: true })

// Tickets
export const TICKET_CATEGORIES = [
  "Production Issue", "Feature Request", "Bug Report", "Question",
  "Access Issue", "Configuration", "Data Issue", "Performance",
  "Billing", "Pending with Insurer", "Other"
] as const

export const TICKET_STATUSES = [
  "New", "Open", "In Progress", "Waiting on Customer",
  "Waiting on Internal", "Pending with Insurer", "Escalated", "Resolved", "Closed"
] as const

export const TICKET_PRIORITIES = ["Critical", "High", "Medium", "Low"] as const

export const createTicketSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(500),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  sub_category: z.string().nullable().optional(),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
  company_id: z.string().min(1, "Company is required"),
  assigned_to_id: z.string().nullable().optional(),
  assigned_to_name: z.string().nullable().optional(),
  assigned_group: z.string().nullable().optional(),
  related_integration_id: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
})

export const updateTicketSchema = z.object({
  id: z.string().min(1, "Ticket ID is required"),
  status: z.string().optional(),
  priority: z.string().optional(),
  assigned_to_id: z.string().nullable().optional(),
  assigned_to_name: z.string().nullable().optional(),
  assigned_group: z.string().nullable().optional(),
  category: z.string().optional(),
  sub_category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  due_date: z.string().nullable().optional(),
  related_integration_id: z.string().nullable().optional(),
})

export const createTicketResponseSchema = z.object({
  body: z.string().min(1, "Response body is required"),
  response_type: z.enum(["reply", "internal_note"]).default("reply"),
})

// Attachment validation
export const ATTACHMENT_MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
export const ATTACHMENT_MAX_FILES_PER_UPLOAD = 5
export const ATTACHMENT_ALLOWED_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/csv": [".csv"],
  "text/plain": [".txt"],
  "application/zip": [".zip"],
}

export const ATTACHMENT_ALLOWED_EXTENSIONS = Object.values(ATTACHMENT_ALLOWED_TYPES).flat()

export function isAllowedFileType(mimeType: string, fileName: string): boolean {
  if (ATTACHMENT_ALLOWED_TYPES[mimeType]) return true
  const ext = "." + fileName.split(".").pop()?.toLowerCase()
  return ATTACHMENT_ALLOWED_EXTENSIONS.includes(ext)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

// Helper to validate and return parsed data or error response
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.errors[0]
    return { success: false, error: firstError?.message || "Validation failed" }
  }
  return { success: true, data: result.data }
}
