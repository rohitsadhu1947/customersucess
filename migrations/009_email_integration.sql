-- Phase 9: Email Integration for Tickets
-- Supports sending emails to insurers from tickets and receiving replies

-- Email templates table (must be created first since email_messages references it)
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  subject_template VARCHAR(1000) NOT NULL,
  body_template TEXT NOT NULL,
  available_variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by_id UUID,
  created_by_name VARCHAR(255),
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates (category);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates (is_active) WHERE is_active = true;

-- Email messages table
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id),
  issue_id UUID REFERENCES project_issues(id),
  ticket_response_id UUID REFERENCES ticket_responses(id),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  from_address VARCHAR(500) NOT NULL,
  from_name VARCHAR(255),
  to_addresses JSONB NOT NULL DEFAULT '[]',
  cc_addresses JSONB DEFAULT '[]',
  reply_to_address VARCHAR(500),
  subject VARCHAR(1000) NOT NULL,
  body_text TEXT,
  body_html TEXT,
  message_id VARCHAR(500),
  in_reply_to VARCHAR(500),
  references_header TEXT,
  template_id UUID REFERENCES email_templates(id),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  resend_email_id VARCHAR(255),
  sent_at TIMESTAMP WITHOUT TIME ZONE,
  delivered_at TIMESTAMP WITHOUT TIME ZONE,
  opened_at TIMESTAMP WITHOUT TIME ZONE,
  bounced_at TIMESTAMP WITHOUT TIME ZONE,
  bounce_reason TEXT,
  sent_by_id UUID,
  sent_by_name VARCHAR(255),
  raw_headers JSONB,
  raw_payload JSONB,
  ai_processed BOOLEAN DEFAULT false,
  ai_summary TEXT,
  ai_extracted_data JSONB,
  ai_processed_at TIMESTAMP WITHOUT TIME ZONE,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_messages_ticket ON email_messages (ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_issue ON email_messages (issue_id) WHERE issue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages (message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON email_messages (direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages (status);

-- Email attachments
CREATE TABLE IF NOT EXISTS email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id UUID NOT NULL REFERENCES email_messages(id),
  file_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  file_data TEXT,
  storage_url VARCHAR(1000),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_attachments_message ON email_attachments (email_message_id);

-- Insurer contacts
CREATE TABLE IF NOT EXISTS insurer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insurer_id UUID NOT NULL REFERENCES insurers(id),
  contact_name VARCHAR(255),
  contact_email VARCHAR(500) NOT NULL,
  contact_role VARCHAR(100),
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_insurer_contacts_insurer ON insurer_contacts (insurer_id);

-- Widen ticket_responses.response_type to support email types
ALTER TABLE ticket_responses ALTER COLUMN response_type TYPE VARCHAR(30);

-- Add email_message_id reference to ticket_responses
ALTER TABLE ticket_responses ADD COLUMN IF NOT EXISTS email_message_id UUID REFERENCES email_messages(id);

-- Seed standard email templates
INSERT INTO email_templates (name, category, subject_template, body_template, available_variables) VALUES
(
  'Claim Status Inquiry',
  'Claim Follow-up',
  '[{{ticket_number}}] Claim Status Inquiry - {{company_name}}',
  E'Dear {{insurer_contact_name}},\n\nI hope this email finds you well.\n\nI am writing to follow up on the claim status for our client {{company_name}}.\n\nTicket Reference: {{ticket_number}}\nCategory: {{ticket_category}}\n\n{{custom_message}}\n\nCould you please provide an update on the current status?\n\nThank you for your assistance.\n\nBest regards,\n{{sender_name}}\nEnsuredit',
  '[{"name": "ticket_number", "description": "Ticket reference number"}, {"name": "company_name", "description": "Client company name"}, {"name": "insurer_contact_name", "description": "Insurer contact name"}, {"name": "ticket_category", "description": "Ticket category"}, {"name": "custom_message", "description": "Custom message body"}, {"name": "sender_name", "description": "Your name"}]'
),
(
  'Document Request',
  'Document Request',
  '[{{ticket_number}}] Document Request - {{company_name}}',
  E'Dear {{insurer_contact_name}},\n\nWe require the following documents for our client {{company_name}}:\n\n{{custom_message}}\n\nTicket Reference: {{ticket_number}}\n\nPlease share the requested documents at your earliest convenience.\n\nBest regards,\n{{sender_name}}\nEnsuredit',
  '[{"name": "ticket_number", "description": "Ticket reference number"}, {"name": "company_name", "description": "Client company name"}, {"name": "insurer_contact_name", "description": "Insurer contact name"}, {"name": "custom_message", "description": "List of documents needed"}, {"name": "sender_name", "description": "Your name"}]'
),
(
  'Issue Escalation',
  'Escalation',
  '[{{ticket_number}}] URGENT: Issue Escalation - {{company_name}}',
  E'Dear {{insurer_contact_name}},\n\nI am escalating the following issue that requires immediate attention:\n\nClient: {{company_name}}\nTicket: {{ticket_number}}\nPriority: {{ticket_priority}}\nCategory: {{ticket_category}}\n\nIssue Description:\n{{custom_message}}\n\nThis matter is time-sensitive and we would appreciate your prompt response.\n\nBest regards,\n{{sender_name}}\nEnsuredit',
  '[{"name": "ticket_number", "description": "Ticket reference number"}, {"name": "company_name", "description": "Client company name"}, {"name": "insurer_contact_name", "description": "Insurer contact name"}, {"name": "ticket_priority", "description": "Ticket priority level"}, {"name": "ticket_category", "description": "Ticket category"}, {"name": "custom_message", "description": "Escalation details"}, {"name": "sender_name", "description": "Your name"}]'
),
(
  'General Follow-up',
  'General',
  '[{{ticket_number}}] Follow-up - {{company_name}}',
  E'Dear {{insurer_contact_name}},\n\nI am following up regarding ticket {{ticket_number}} for {{company_name}}.\n\n{{custom_message}}\n\nLooking forward to your response.\n\nBest regards,\n{{sender_name}}\nEnsuredit',
  '[{"name": "ticket_number", "description": "Ticket reference number"}, {"name": "company_name", "description": "Client company name"}, {"name": "insurer_contact_name", "description": "Insurer contact name"}, {"name": "custom_message", "description": "Follow-up message"}, {"name": "sender_name", "description": "Your name"}]'
),
(
  'API Integration Query',
  'Integration',
  '[{{ticket_number}}] API Integration Query - {{company_name}}',
  E'Dear {{insurer_contact_name}},\n\nWe are reaching out regarding an API integration matter for our client {{company_name}}.\n\n{{custom_message}}\n\nTicket Reference: {{ticket_number}}\n\nPlease advise on the above at your earliest convenience.\n\nBest regards,\n{{sender_name}}\nEnsuredit',
  '[{"name": "ticket_number", "description": "Ticket reference number"}, {"name": "company_name", "description": "Client company name"}, {"name": "insurer_contact_name", "description": "Insurer contact name"}, {"name": "custom_message", "description": "Integration query details"}, {"name": "sender_name", "description": "Your name"}]'
);
