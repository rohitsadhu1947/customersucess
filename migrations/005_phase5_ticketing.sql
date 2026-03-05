-- Phase 5: Ticketing & Case Management Module
-- Run this migration on Neon Postgres

-- Sequence for auto-generating ticket numbers
CREATE SEQUENCE IF NOT EXISTS ticket_seq START 1;

-- Main tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(20) NOT NULL UNIQUE,
  subject VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Other',
  sub_category VARCHAR(100),
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
  status VARCHAR(50) NOT NULL DEFAULT 'New',
  source VARCHAR(20) NOT NULL DEFAULT 'web',

  -- Company & people
  company_id UUID NOT NULL REFERENCES companies(id),
  company_name VARCHAR(255),
  created_by_id UUID NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  assigned_to_id UUID,
  assigned_to_name VARCHAR(255),
  assigned_group VARCHAR(100),

  -- Optional link to integration project
  related_integration_id UUID REFERENCES integration_projects(id),

  -- Tags stored as JSON array
  tags JSONB DEFAULT '[]',

  -- SLA & dates
  due_date TIMESTAMP WITHOUT TIME ZONE,
  first_response_at TIMESTAMP WITHOUT TIME ZONE,
  resolved_at TIMESTAMP WITHOUT TIME ZONE,
  closed_at TIMESTAMP WITHOUT TIME ZONE,
  sla_breach BOOLEAN DEFAULT false,
  sla_response_breach BOOLEAN DEFAULT false,

  -- Standard fields
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets (ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets (company_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets (priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets (assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets (created_by_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_breach ON tickets (sla_breach) WHERE sla_breach = true;

-- Ticket responses (thread messages)
CREATE TABLE IF NOT EXISTS ticket_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  response_type VARCHAR(20) NOT NULL DEFAULT 'reply',
  body TEXT NOT NULL,
  created_by_id UUID NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_by_role VARCHAR(50),
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_responses_ticket ON ticket_responses (ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ticket_responses_type ON ticket_responses (ticket_id, response_type);

-- Ticket history (activity log)
CREATE TABLE IF NOT EXISTS ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  user_id UUID NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket ON ticket_history (ticket_id, created_at DESC);
