import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { createCredentialSchema, updateCredentialSchema, validateBody } from "@/lib/validations"
import { logAudit } from "@/lib/audit"

// GET - List credentials for an integration project
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    // Verify the integration project exists and user has access
    let project
    if (user.role === "Customer" || user.role === "Customer View Only") {
      project = await sql`
        SELECT id, company_id FROM integration_projects
        WHERE id = ${id} AND company_id = ${user.companyId}
          AND (is_deleted = false OR is_deleted IS NULL)
      `
    } else {
      project = await sql`
        SELECT id, company_id FROM integration_projects
        WHERE id = ${id} AND (is_deleted = false OR is_deleted IS NULL)
      `
    }

    if (!project || project.length === 0) {
      return NextResponse.json({ error: "Integration project not found" }, { status: 404 })
    }

    const credentials = await sql`
      SELECT * FROM integration_credentials
      WHERE integration_project_id = ${id} AND is_deleted = false
      ORDER BY environment ASC, created_at DESC
    `

    // For "Customer View Only" — mask actual credential values
    if (user.role === "Customer View Only") {
      const masked = credentials.map((cred: any) => ({
        id: cred.id,
        integration_project_id: cred.integration_project_id,
        environment: cred.environment,
        has_token: !!cred.credential_token,
        has_user_id: !!cred.credential_user_id,
        has_password: !!cred.credential_password,
        has_additional_fields: cred.additional_fields && Object.keys(cred.additional_fields).length > 0,
        additional_field_keys: cred.additional_fields ? Object.keys(cred.additional_fields) : [],
        notes: cred.notes,
        is_active: cred.is_active,
        created_by_name: cred.created_by_name,
        updated_by_name: cred.updated_by_name,
        created_at: cred.created_at,
        updated_at: cred.updated_at,
      }))
      return NextResponse.json(masked)
    }

    return NextResponse.json(credentials)
  } catch (error) {
    console.error("Credentials GET error:", error)
    return NextResponse.json({ error: "Failed to fetch credentials" }, { status: 500 })
  }
}

// POST - Create a new credential set
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    if (!["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validation = validateBody(createCredentialSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { environment, credential_token, credential_user_id, credential_password, additional_fields, notes } = validation.data

    // Verify the integration project exists and user has access
    let project
    if (user.role === "Customer") {
      project = await sql`
        SELECT id FROM integration_projects
        WHERE id = ${id} AND company_id = ${user.companyId}
          AND (is_deleted = false OR is_deleted IS NULL)
      `
    } else {
      project = await sql`
        SELECT id FROM integration_projects
        WHERE id = ${id} AND (is_deleted = false OR is_deleted IS NULL)
      `
    }

    if (!project || project.length === 0) {
      return NextResponse.json({ error: "Integration project not found" }, { status: 404 })
    }

    // Check for existing active credential for same environment
    const existing = await sql`
      SELECT id FROM integration_credentials
      WHERE integration_project_id = ${id} AND environment = ${environment}
        AND is_deleted = false
    `
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `Credentials for ${environment} environment already exist. Please edit the existing credentials instead.` },
        { status: 409 }
      )
    }

    const [newCredential] = await sql`
      INSERT INTO integration_credentials (
        integration_project_id, environment,
        credential_token, credential_user_id, credential_password,
        additional_fields, notes,
        created_by_id, created_by_name
      ) VALUES (
        ${id}, ${environment},
        ${credential_token || null}, ${credential_user_id || null}, ${credential_password || null},
        ${JSON.stringify(additional_fields || {})}, ${notes || null},
        ${user.userId}, ${user.name}
      )
      RETURNING *
    `

    // Auto-update parent project's boolean flags
    if (environment === "UAT") {
      await sql`
        UPDATE integration_projects
        SET insurer_uat_creds_received = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `
    } else if (environment === "Production") {
      await sql`
        UPDATE integration_projects
        SET prod_creds_received = true, prod_cred_receipt_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `
    }

    // Audit log — do NOT include credential values
    await logAudit({
      userId: user.userId,
      action: "create",
      entityType: "integration_credential",
      entityId: newCredential.id,
      details: { integration_project_id: id, environment },
    })

    return NextResponse.json(newCredential, { status: 201 })
  } catch (error) {
    console.error("Credentials POST error:", error)
    return NextResponse.json({ error: "Failed to create credentials" }, { status: 500 })
  }
}

// PUT - Update an existing credential set
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    if (!["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"].includes(user.role as string)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validation = validateBody(updateCredentialSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { id: credentialId, credential_token, credential_user_id, credential_password, additional_fields, notes } = validation.data

    // Verify the credential belongs to this project and user has access
    let credential
    if (user.role === "Customer") {
      credential = await sql`
        SELECT ic.id FROM integration_credentials ic
        JOIN integration_projects ip ON ic.integration_project_id = ip.id
        WHERE ic.id = ${credentialId} AND ic.integration_project_id = ${id}
          AND ip.company_id = ${user.companyId}
          AND ic.is_deleted = false
      `
    } else {
      credential = await sql`
        SELECT id FROM integration_credentials
        WHERE id = ${credentialId} AND integration_project_id = ${id}
          AND is_deleted = false
      `
    }

    if (!credential || credential.length === 0) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 })
    }

    const [updated] = await sql`
      UPDATE integration_credentials SET
        credential_token = COALESCE(${credential_token !== undefined ? credential_token : null}, credential_token),
        credential_user_id = COALESCE(${credential_user_id !== undefined ? credential_user_id : null}, credential_user_id),
        credential_password = COALESCE(${credential_password !== undefined ? credential_password : null}, credential_password),
        additional_fields = COALESCE(${additional_fields ? JSON.stringify(additional_fields) : null}, additional_fields),
        notes = COALESCE(${notes !== undefined ? notes : null}, notes),
        updated_by_id = ${user.userId},
        updated_by_name = ${user.name},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${credentialId}
      RETURNING *
    `

    await logAudit({
      userId: user.userId,
      action: "update",
      entityType: "integration_credential",
      entityId: credentialId!,
      details: { integration_project_id: id },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Credentials PUT error:", error)
    return NextResponse.json({ error: "Failed to update credentials" }, { status: 500 })
  }
}

// DELETE - Soft delete a credential set
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth()
    const { id } = await params

    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Only admins can delete credentials" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const credentialId = searchParams.get("credentialId")

    if (!credentialId) {
      return NextResponse.json({ error: "Credential ID is required" }, { status: 400 })
    }

    await sql`
      UPDATE integration_credentials
      SET is_deleted = true, updated_by_id = ${user.userId}, updated_by_name = ${user.name}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${credentialId} AND integration_project_id = ${id}
    `

    await logAudit({
      userId: user.userId,
      action: "delete",
      entityType: "integration_credential",
      entityId: credentialId,
      details: { integration_project_id: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Credentials DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete credentials" }, { status: 500 })
  }
}
