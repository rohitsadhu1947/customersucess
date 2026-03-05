-- Phase 6: Integration Credentials Management
-- Stores UAT and Production credentials per integration project

CREATE TABLE IF NOT EXISTS integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_project_id UUID NOT NULL REFERENCES integration_projects(id),
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('UAT', 'Production')),

  -- Credential fields (names may be renamed later per business requirements)
  credential_token TEXT,
  credential_user_id TEXT,
  credential_password TEXT,

  -- Extensibility for additional credential fields
  additional_fields JSONB DEFAULT '{}',

  -- Metadata
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,

  created_by_id UUID NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  updated_by_id UUID,
  updated_by_name VARCHAR(255),

  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_integration_credentials_project
  ON integration_credentials (integration_project_id);
CREATE INDEX IF NOT EXISTS idx_integration_credentials_env
  ON integration_credentials (integration_project_id, environment);
