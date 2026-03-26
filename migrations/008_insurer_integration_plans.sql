-- Phase 7: Insurer Integration Plans
-- Tracks which plans (products/sub-products) are integrated per insurer with dates

CREATE TABLE IF NOT EXISTS insurer_integration_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insurer_id UUID NOT NULL REFERENCES insurers(id),
  product_id UUID NOT NULL REFERENCES products(id),
  sub_product_id UUID REFERENCES sub_products(id),

  -- Plan integration status
  status VARCHAR(50) NOT NULL DEFAULT 'Planned',
  -- Planned, In Development, UAT, Live, Deprecated

  -- Key integration dates
  planned_date DATE,
  development_start_date DATE,
  uat_start_date DATE,
  go_live_date DATE,

  -- Notes and context
  notes TEXT,
  api_version VARCHAR(50),

  -- Audit
  created_by_id UUID NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  updated_by_id UUID,
  updated_by_name VARCHAR(255),
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Prevent duplicate entries per insurer + product + sub_product
  UNIQUE(insurer_id, product_id, sub_product_id)
);

CREATE INDEX IF NOT EXISTS idx_insurer_plans_insurer ON insurer_integration_plans (insurer_id);
CREATE INDEX IF NOT EXISTS idx_insurer_plans_status ON insurer_integration_plans (insurer_id, status);
CREATE INDEX IF NOT EXISTS idx_insurer_plans_product ON insurer_integration_plans (product_id);
