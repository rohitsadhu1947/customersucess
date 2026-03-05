import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

// GET - Search across companies, issues, and integrations
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth()

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")

    // If query is empty or less than 2 characters, return empty results
    if (!q || q.trim().length < 2) {
      return NextResponse.json({ companies: [], issues: [], integrations: [] })
    }

    const query = q.trim().toLowerCase()
    const isCustomer = user.role === "Customer" || user.role === "Customer View Only"

    // Companies (only for non-customer roles)
    let companies: any[] = []
    if (!isCustomer) {
      companies = await sql`
        SELECT id, name FROM companies
        WHERE LOWER(name) LIKE ${`%${query}%`}
        LIMIT 5
      `
    }

    // Issues (filter by company_id for customers)
    let issues
    if (isCustomer) {
      issues = await sql`
        SELECT id, title, status FROM project_issues
        WHERE company_id = ${user.companyId}
          AND (LOWER(title) LIKE ${`%${query}%`} OR LOWER(description) LIKE ${`%${query}%`})
        LIMIT 5
      `
    } else {
      issues = await sql`
        SELECT id, title, status FROM project_issues
        WHERE LOWER(title) LIKE ${`%${query}%`} OR LOWER(description) LIKE ${`%${query}%`}
        LIMIT 5
      `
    }

    // Integrations (filter by company_id for customers)
    let integrations
    if (isCustomer) {
      integrations = await sql`
        SELECT ip.id, c.name as company_name, i.name as insurer_name, ip.status
        FROM integration_projects ip
        LEFT JOIN companies c ON ip.company_id = c.id
        LEFT JOIN insurers i ON ip.insurer_id = i.id
        WHERE ip.company_id = ${user.companyId}
          AND (LOWER(c.name) LIKE ${`%${query}%`} OR LOWER(i.name) LIKE ${`%${query}%`})
        LIMIT 5
      `
    } else {
      integrations = await sql`
        SELECT ip.id, c.name as company_name, i.name as insurer_name, ip.status
        FROM integration_projects ip
        LEFT JOIN companies c ON ip.company_id = c.id
        LEFT JOIN insurers i ON ip.insurer_id = i.id
        WHERE LOWER(c.name) LIKE ${`%${query}%`} OR LOWER(i.name) LIKE ${`%${query}%`}
        LIMIT 5
      `
    }

    // Tickets (filter by company_id for customers)
    let tickets
    if (isCustomer) {
      tickets = await sql`
        SELECT id, ticket_number, subject, status FROM tickets
        WHERE company_id = ${user.companyId}
          AND (LOWER(ticket_number) LIKE ${`%${query}%`} OR LOWER(subject) LIKE ${`%${query}%`})
          AND (is_deleted = false OR is_deleted IS NULL)
        LIMIT 5
      `
    } else {
      tickets = await sql`
        SELECT id, ticket_number, subject, status FROM tickets
        WHERE (LOWER(ticket_number) LIKE ${`%${query}%`} OR LOWER(subject) LIKE ${`%${query}%`})
          AND (is_deleted = false OR is_deleted IS NULL)
        LIMIT 5
      `
    }

    return NextResponse.json({ companies, issues, integrations, tickets })
  } catch (error) {
    console.error("Search GET error:", error)
    return NextResponse.json({ error: "Failed to perform search" }, { status: 500 })
  }
}
