-- Phase 5.1: Ticket File Attachments
-- Run this migration on Neon Postgres

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  response_id UUID REFERENCES ticket_responses(id),
  file_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  file_data TEXT NOT NULL,
  uploaded_by_id UUID NOT NULL,
  uploaded_by_name VARCHAR(255) NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments (ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_response ON ticket_attachments (response_id) WHERE response_id IS NOT NULL;
