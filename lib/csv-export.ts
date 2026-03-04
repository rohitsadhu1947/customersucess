// lib/csv-export.ts - CSV Export Utility Functions

export interface CSVColumn {
  key: string
  label: string
  transform?: (value: any) => string
}

export function generateCSV(data: any[], columns: CSVColumn[]): string {
  // Create header row
  const headers = columns.map((col) => `"${col.label}"`).join(",")

  // Create data rows
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        let value = item[col.key]

        // Apply transformation if provided
        if (col.transform && value !== null && value !== undefined) {
          value = col.transform(value)
        }

        // Handle null/undefined values
        if (value === null || value === undefined) {
          value = ""
        }

        // Convert to string and escape quotes
        const stringValue = String(value).replace(/"/g, '""')
        return `"${stringValue}"`
      })
      .join(",")
  })

  return [headers, ...rows].join("\n")
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

export function formatDate(dateString: string): string {
  if (!dateString) return ""
  return new Date(dateString).toLocaleDateString()
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return ""
  return new Date(dateString).toLocaleString()
}

export function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No"
}

// Integration Projects CSV Configuration
export const integrationProjectsColumns: CSVColumn[] = [
  { key: "id", label: "Project ID" },
  { key: "company_name", label: "Company" },
  { key: "product_display_name", label: "Product Platform" },
  { key: "sub_product_display_name", label: "Insurance Product" },
  { key: "insurer_name", label: "Insurance Partner" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "api_kit_received", label: "API Kit Received", transform: formatBoolean },
  { key: "api_kit_received_date", label: "API Kit Date", transform: formatDate },
  { key: "creds_verified", label: "Credentials Verified", transform: formatBoolean },
  { key: "creds_verification_date", label: "Credentials Date", transform: formatDate },
  { key: "dev_start_date", label: "Dev Start Date", transform: formatDate },
  { key: "dev_end_date", label: "Dev End Date", transform: formatDate },
  { key: "dev_estimated_hours", label: "Estimated Dev Hours" },
  { key: "internal_testing_start_date", label: "Testing Start Date", transform: formatDate },
  { key: "internal_testing_end_date", label: "Testing End Date", transform: formatDate },
  { key: "insurer_uat_creds_received", label: "UAT Credentials Received", transform: formatBoolean },
  { key: "insurer_uat_start_date", label: "UAT Start Date", transform: formatDate },
  { key: "insurer_uat_end_date", label: "UAT End Date", transform: formatDate },
  { key: "prod_creds_received", label: "Prod Credentials Received", transform: formatBoolean },
  { key: "prod_cred_receipt_date", label: "Prod Credentials Date", transform: formatDate },
  { key: "go_live_planned_date", label: "Planned Go Live Date", transform: formatDate },
  { key: "go_live_date", label: "Actual Go Live Date", transform: formatDate },
  { key: "current_blockers", label: "Current Blockers" },
  { key: "technical_notes", label: "Technical Notes" },
  { key: "business_notes", label: "Business Notes" },
  { key: "created_by_name", label: "Created By" },
  { key: "created_at", label: "Created Date", transform: formatDateTime },
  { key: "updated_at", label: "Last Updated", transform: formatDateTime },
]

// Issues CSV Configuration
export const issuesColumns: CSVColumn[] = [
  { key: "id", label: "Issue ID" },
  { key: "title", label: "Issue Title" },
  { key: "description", label: "Description" },
  { key: "company_name", label: "Company" },
  { key: "issue_category", label: "Category" },
  { key: "sub_category", label: "Sub Category" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "raised_by_name", label: "Raised By" },
  { key: "assigned_to_name", label: "Assigned To" },
  { key: "due_date", label: "Due Date", transform: formatDate },
  { key: "resolution_type", label: "Resolution Type" },
  { key: "resolved_at", label: "Resolved Date", transform: formatDateTime },
  { key: "created_at", label: "Created Date", transform: formatDateTime },
  { key: "updated_at", label: "Last Updated", transform: formatDateTime },
]

// Companies CSV Configuration
export const companiesColumns: CSVColumn[] = [
  { key: "id", label: "Company ID" },
  { key: "name", label: "Company Name" },
  { key: "status", label: "Status" },
  { key: "customer_since", label: "Customer Since", transform: formatDate },
  { key: "ensuredit_lead_name", label: "EnsuredIt Lead" },
  { key: "client_lead_name", label: "Client Lead Name" },
  { key: "client_lead_email", label: "Client Lead Email" },
  { key: "user_count", label: "Total Users" },
  { key: "active_user_count", label: "Active Users" },
  { key: "notes", label: "Notes" },
  { key: "created_at", label: "Created Date", transform: formatDateTime },
  { key: "updated_at", label: "Last Updated", transform: formatDateTime },
]

// Users CSV Configuration
export const usersColumns: CSVColumn[] = [
  { key: "id", label: "User ID" },
  { key: "name", label: "Full Name" },
  { key: "email", label: "Email Address" },
  { key: "role_type", label: "Role" },
  { key: "company_name", label: "Company" },
  { key: "is_active", label: "Active", transform: formatBoolean },
  { key: "email_verified", label: "Email Verified", transform: (val) => (val ? formatDateTime(val) : "No") },
  { key: "two_factor_enabled", label: "Two Factor Enabled", transform: formatBoolean },
  { key: "last_login", label: "Last Login", transform: formatDateTime },
  { key: "created_at", label: "Created Date", transform: formatDateTime },
  { key: "updated_at", label: "Last Updated", transform: formatDateTime },
]

// Export function for Integration Projects
export function exportIntegrationProjects(projects: any[]): void {
  const csvContent = generateCSV(projects, integrationProjectsColumns)
  const timestamp = new Date().toISOString().split("T")[0]
  downloadCSV(csvContent, `integration-projects-${timestamp}.csv`)
}

// Export function for Issues
export function exportIssues(issues: any[]): void {
  const csvContent = generateCSV(issues, issuesColumns)
  const timestamp = new Date().toISOString().split("T")[0]
  downloadCSV(csvContent, `issues-${timestamp}.csv`)
}

// Export function for Companies
export function exportCompanies(companies: any[]): void {
  const csvContent = generateCSV(companies, companiesColumns)
  const timestamp = new Date().toISOString().split("T")[0]
  downloadCSV(csvContent, `companies-${timestamp}.csv`)
}

// Export function for Users
export function exportUsers(users: any[]): void {
  const csvContent = generateCSV(users, usersColumns)
  const timestamp = new Date().toISOString().split("T")[0]
  downloadCSV(csvContent, `users-${timestamp}.csv`)
}
