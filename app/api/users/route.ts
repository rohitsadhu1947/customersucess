import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { createUserSchema, updateUserSchema, validateBody } from "@/lib/validations"
import { getPaginationParams, paginatedResponse } from "@/lib/pagination"
import { logAudit } from "@/lib/audit"

// GET - Fetch all users with company info
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth()

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("company_id")
    const roleType = searchParams.get("role_type")
    const isActive = searchParams.get("is_active")
    const usePagination = searchParams.has("page")

    let users

    // Build query based on role and filters
    if (user.role === "Customer" || user.role === "Customer View Only") {
      if (usePagination) {
        const params = getPaginationParams(request)
        const [{ count: total }] = await sql`
          SELECT COUNT(*) as count FROM users WHERE company_id = ${user.companyId}
        `
        users = await sql`
          SELECT
            u.id, u.name, u.email, u.role_type, u.is_active,
            u.email_verified, u.two_factor_enabled, u.last_login,
            u.created_at, u.updated_at,
            c.name as company_name
          FROM users u
          LEFT JOIN companies c ON u.company_id = c.id
          WHERE u.company_id = ${user.companyId}
          ORDER BY u.name ASC
          LIMIT ${params.limit} OFFSET ${params.offset}
        `
        return NextResponse.json(paginatedResponse(users, Number(total), params))
      } else {
        // Customer can only see users from their own company
        users = await sql`
          SELECT
            u.id, u.name, u.email, u.role_type, u.is_active,
            u.email_verified, u.two_factor_enabled, u.last_login,
            u.created_at, u.updated_at,
            c.name as company_name
          FROM users u
          LEFT JOIN companies c ON u.company_id = c.id
          WHERE u.company_id = ${user.companyId}
          ORDER BY u.name ASC
        `
      }
    } else {
      // Admin, Ensuredit can see all users with optional filters
      if (usePagination) {
        const params = getPaginationParams(request)
        let countResult
        if (companyId) {
          countResult = await sql`SELECT COUNT(*) as count FROM users WHERE company_id = ${companyId}`
        } else if (roleType) {
          countResult = await sql`SELECT COUNT(*) as count FROM users WHERE role_type = ${roleType}`
        } else if (isActive) {
          countResult = await sql`SELECT COUNT(*) as count FROM users WHERE is_active = ${isActive === "true"}`
        } else {
          countResult = await sql`SELECT COUNT(*) as count FROM users`
        }
        const total = countResult[0].count

        if (companyId) {
          users = await sql`
            SELECT
              u.id, u.name, u.email, u.role_type, u.is_active,
              u.email_verified, u.two_factor_enabled, u.last_login,
              u.created_at, u.updated_at, u.company_id,
              c.name as company_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            WHERE u.company_id = ${companyId}
            ORDER BY u.name ASC
            LIMIT ${params.limit} OFFSET ${params.offset}
          `
        } else if (roleType) {
          users = await sql`
            SELECT
              u.id, u.name, u.email, u.role_type, u.is_active,
              u.email_verified, u.two_factor_enabled, u.last_login,
              u.created_at, u.updated_at, u.company_id,
              c.name as company_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            WHERE u.role_type = ${roleType}
            ORDER BY u.name ASC
            LIMIT ${params.limit} OFFSET ${params.offset}
          `
        } else if (isActive) {
          users = await sql`
            SELECT
              u.id, u.name, u.email, u.role_type, u.is_active,
              u.email_verified, u.two_factor_enabled, u.last_login,
              u.created_at, u.updated_at, u.company_id,
              c.name as company_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            WHERE u.is_active = ${isActive === "true"}
            ORDER BY u.name ASC
            LIMIT ${params.limit} OFFSET ${params.offset}
          `
        } else {
          users = await sql`
            SELECT
              u.id, u.name, u.email, u.role_type, u.is_active,
              u.email_verified, u.two_factor_enabled, u.last_login,
              u.created_at, u.updated_at, u.company_id,
              c.name as company_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            ORDER BY u.name ASC
            LIMIT ${params.limit} OFFSET ${params.offset}
          `
        }
        return NextResponse.json(paginatedResponse(users, Number(total), params))
      } else {
        if (companyId) {
          users = await sql`
            SELECT
              u.id, u.name, u.email, u.role_type, u.is_active,
              u.email_verified, u.two_factor_enabled, u.last_login,
              u.created_at, u.updated_at, u.company_id,
              c.name as company_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            WHERE u.company_id = ${companyId}
            ORDER BY u.name ASC
          `
        } else if (roleType) {
          users = await sql`
            SELECT
              u.id, u.name, u.email, u.role_type, u.is_active,
              u.email_verified, u.two_factor_enabled, u.last_login,
              u.created_at, u.updated_at, u.company_id,
              c.name as company_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            WHERE u.role_type = ${roleType}
            ORDER BY u.name ASC
          `
        } else if (isActive) {
          users = await sql`
            SELECT
              u.id, u.name, u.email, u.role_type, u.is_active,
              u.email_verified, u.two_factor_enabled, u.last_login,
              u.created_at, u.updated_at, u.company_id,
              c.name as company_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            WHERE u.is_active = ${isActive === "true"}
            ORDER BY u.name ASC
          `
        } else {
          users = await sql`
            SELECT
              u.id, u.name, u.email, u.role_type, u.is_active,
              u.email_verified, u.two_factor_enabled, u.last_login,
              u.created_at, u.updated_at, u.company_id,
              c.name as company_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            ORDER BY u.name ASC
          `
        }
      }
    }

    return NextResponse.json(users)
  } catch (error) {
    console.error("Users GET error:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

// POST - Create new user (Fixed to match your exact database schema)
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (!["Admin", "Ensuredit"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validation = validateBody(createUserSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const {
      name,
      email,
      password,
      role_type,
      company_id,
      is_active,
      email_verified,
      two_factor_enabled,
    } = validation.data

    // Check if email already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email}
    `

    if (existingUsers.length > 0) {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Convert email_verified boolean to timestamp (your schema expects TIMESTAMP)
    const emailVerifiedTimestamp = email_verified ? new Date().toISOString() : null

    // Create user with correct field types
    const newUsers = await sql`
      INSERT INTO users (
        name, 
        email, 
        password_hash, 
        role_type, 
        company_id,
        provider,
        is_active,
        email_verified,
        two_factor_enabled,
        created_by_id
      ) VALUES (
        ${name.trim()}, 
        ${email.trim().toLowerCase()}, 
        ${hashedPassword}, 
        ${role_type}, 
        ${company_id || null},
        'credentials',
        ${is_active},
        ${emailVerifiedTimestamp},
        ${two_factor_enabled},
        ${user.userId}
      )
      RETURNING 
        id, name, email, role_type, company_id, is_active, 
        email_verified, two_factor_enabled, created_at
    `

    await logAudit({ userId: user.userId, action: "create", entityType: "user", entityId: newUsers[0].id, details: { name, email } })

    return NextResponse.json(newUsers[0], { status: 201 })
  } catch (error) {
    console.error("Users POST error:", error)
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 },
    )
  }
}

// PUT - Update user (Fixed to match your database schema)
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (!["Admin", "Ensuredit"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validation = validateBody(updateUserSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { id, name, email, role_type, company_id, is_active, email_verified, two_factor_enabled, password } = validation.data

    // Convert email_verified boolean to timestamp
    const emailVerifiedTimestamp = email_verified ? new Date().toISOString() : null

    // Build update query - only update password if provided
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12)
      const updatedUsers = await sql`
        UPDATE users 
        SET 
          name = ${name},
          email = ${email},
          password_hash = ${hashedPassword},
          role_type = ${role_type},
          company_id = ${company_id || null},
          is_active = ${is_active},
          email_verified = ${emailVerifiedTimestamp},
          two_factor_enabled = ${two_factor_enabled},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING 
          id, name, email, role_type, company_id, is_active, 
          email_verified, two_factor_enabled, updated_at
      `
      await logAudit({ userId: user.userId, action: "update", entityType: "user", entityId: id })
      return NextResponse.json(updatedUsers[0])
    } else {
      const updatedUsers = await sql`
        UPDATE users 
        SET 
          name = ${name},
          email = ${email},
          role_type = ${role_type},
          company_id = ${company_id || null},
          is_active = ${is_active},
          email_verified = ${emailVerifiedTimestamp},
          two_factor_enabled = ${two_factor_enabled},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING 
          id, name, email, role_type, company_id, is_active, 
          email_verified, two_factor_enabled, updated_at
      `
      await logAudit({ userId: user.userId, action: "update", entityType: "user", entityId: id })
      return NextResponse.json(updatedUsers[0])
    }
  } catch (error) {
    console.error("Users PUT error:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

// DELETE - Delete user
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth()

    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Don't allow deleting yourself
    if (id === user.userId) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
    }

    // Check if user is referenced in other tables
    const [projectUsage] = await sql`
      SELECT COUNT(*) as count FROM integration_projects WHERE created_by_id = ${id}
    `

    const [issueUsage] = await sql`
      SELECT COUNT(*) as count FROM project_issues WHERE raised_by_id = ${id} OR assigned_to_id = ${id}
    `

    if (Number.parseInt(projectUsage.count) > 0 || Number.parseInt(issueUsage.count) > 0) {
      // Soft delete - set is_active to false
      await sql`
        UPDATE users 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `
      return NextResponse.json({ success: true, message: "User deactivated (has related records)" })
    } else {
      // Hard delete if no related records
      await sql`
        DELETE FROM users 
        WHERE id = ${id}
      `
      return NextResponse.json({ success: true, message: "User deleted" })
    }
  } catch (error) {
    console.error("Users DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}
