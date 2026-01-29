-- MANA88 CMS Database Schema
-- Supabase/PostgreSQL Migration
-- Version: 1.0.0
-- Date: 2026-01-29

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM TYPES
-- ============================================
CREATE TYPE unit_status AS ENUM ('available', 'reserved', 'sold', 'blocked');
CREATE TYPE case_status AS ENUM ('pending', 'active', 'contract_generated', 'executed', 'cancelled', 'on_hold');
CREATE TYPE payment_type AS ENUM ('reserva', 'enganche', 'mensualidad', 'entrega', 'balloon', 'adjustment', 'refund');
CREATE TYPE schedule_status AS ENUM ('pending', 'paid', 'partial', 'overdue', 'waived');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE staff_role AS ENUM ('admin', 'finance', 'legal', 'broker', 'viewer');

-- ============================================
-- CORE TABLES
-- ============================================

-- Units/Properties (Inventory)
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manzana VARCHAR(10) NOT NULL,
  lot VARCHAR(10) NOT NULL,
  surface_m2 DECIMAL(10,2),
  list_price_mxn DECIMAL(14,2),
  current_price_mxn DECIMAL(14,2),
  status unit_status DEFAULT 'available',
  property_type VARCHAR(50) DEFAULT 'lot',
  folder_path TEXT,
  chepina_url TEXT,  -- Property image URL
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(manzana, lot)
);

-- Clients/Buyers
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Primary buyer
  full_name VARCHAR(255) NOT NULL,
  email_primary VARCHAR(255),
  phone_primary VARCHAR(50),
  
  -- Secondary buyer (co-buyer)
  full_name_secondary VARCHAR(255),
  email_secondary VARCHAR(255),
  phone_secondary VARCHAR(50),
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  
  -- Documents
  nationality VARCHAR(100),
  id_document_url TEXT,
  proof_of_address_url TEXT,
  
  -- Metadata
  is_llc BOOLEAN DEFAULT FALSE,
  llc_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Cases (Master Record)
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(50) UNIQUE NOT NULL,  -- MANA88-AK-0001 format
  unit_id UUID REFERENCES units(id),
  client_id UUID REFERENCES clients(id),
  
  -- Pricing (DECIMAL for centavo precision)
  list_price_mxn DECIMAL(14,2),
  sale_price_mxn DECIMAL(14,2) NOT NULL,
  discount_pct DECIMAL(5,2),
  
  -- Payment Plan
  plan_name VARCHAR(100),  -- '30/60/10', '90/10', 'Custom'
  down_payment_pct DECIMAL(5,2),
  down_payment_mxn DECIMAL(14,2),
  monthly_payment_count INTEGER,
  monthly_payment_amount DECIMAL(14,2),
  final_payment_pct DECIMAL(5,2) DEFAULT 10,
  final_payment_mxn DECIMAL(14,2),
  
  -- Broker Info
  broker_name VARCHAR(255),
  broker_agency VARCHAR(255),
  broker_email VARCHAR(255),
  broker_phone VARCHAR(50),
  broker_commission_pct DECIMAL(5,2),
  
  -- Status
  status case_status DEFAULT 'pending',
  
  -- Documents
  offer_doc_url TEXT,
  offer_pdf_url TEXT,
  contract_doc_url TEXT,
  contract_pdf_url TEXT,
  folder_url TEXT,
  
  -- Timeline
  contract_drafted_at TIMESTAMPTZ,
  sent_for_signature_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  delivery_date DATE,
  
  -- Legal
  assigned_legal_owner VARCHAR(255),
  
  -- Schedule (JSONB for full flexibility)
  schedule_raw JSONB,  -- Array of {type, label, amount, date, ...}
  
  -- Legacy Migration
  dto_json JSONB,  -- Full legacy DTO for reference
  dp_payments_json JSONB,
  custom_payments_json JSONB,
  
  -- Metadata
  notes TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Schedule (Expected Payments)
CREATE TABLE payment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  
  schedule_index INTEGER NOT NULL,  -- 0, 1, 2, ...
  payment_type payment_type NOT NULL,
  label VARCHAR(255),
  
  amount_mxn DECIMAL(14,2) NOT NULL,
  due_date DATE NOT NULL,
  
  -- Status tracking
  status schedule_status DEFAULT 'pending',
  paid_amount_mxn DECIMAL(14,2) DEFAULT 0,
  paid_at TIMESTAMPTZ,
  
  -- Metadata
  date_calculated BOOLEAN DEFAULT FALSE,
  date_calculated_on TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(case_id, schedule_index)
);

-- Payments (Actual Transactions)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE RESTRICT NOT NULL,
  client_id UUID REFERENCES clients(id),
  
  -- Payment Details
  payment_date DATE NOT NULL,
  payment_month VARCHAR(7),  -- '2025-03' for grouping
  
  -- Amount (DECIMAL for centavo precision)
  amount_mxn DECIMAL(14,2) NOT NULL,
  amount_original DECIMAL(14,2),
  currency_original VARCHAR(10) DEFAULT 'MXN',
  fx_rate_used DECIMAL(10,6),
  
  -- Classification
  payment_type payment_type NOT NULL,
  applied_to_installment INTEGER,  -- Links to schedule_index
  schedule_id UUID REFERENCES payment_schedule(id),
  
  -- Proof Documents
  mana_proof_url TEXT,
  client_proof_url TEXT,
  receipt_pdf_url TEXT,
  
  -- Transaction Details
  channel VARCHAR(50),  -- 'wire', 'cash', 'check', 'card'
  reference_number VARCHAR(100),
  bank_name VARCHAR(100),
  
  -- Tracking
  entered_by VARCHAR(255),
  source VARCHAR(50),  -- 'client-console', 'legacy-import', 'manual'
  
  -- Notes
  notes TEXT,
  
  -- Audit
  audit_id UUID DEFAULT gen_random_uuid(),
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by VARCHAR(255),
  verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Allocations (How payments are applied)
CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE NOT NULL,
  schedule_id UUID REFERENCES payment_schedule(id) ON DELETE CASCADE NOT NULL,
  
  amount_mxn DECIMAL(14,2) NOT NULL,
  allocation_type VARCHAR(50),  -- 'principal', 'interest', 'fee', 'overpayment'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval Queue
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  
  request_type VARCHAR(50),  -- 'new_case', 'price_change', 'amendment', 'cancellation'
  request_data JSONB,  -- Details of what's being requested
  
  requested_by VARCHAR(255),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  
  status approval_status DEFAULT 'pending',
  
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff/Users
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID,  -- Links to Supabase auth.users
  
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role staff_role DEFAULT 'viewer',
  
  is_active BOOLEAN DEFAULT TRUE,
  is_approver BOOLEAN DEFAULT FALSE,
  
  department VARCHAR(100),
  phone VARCHAR(50),
  
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ DEFAULT NOW(),
  
  actor VARCHAR(255),
  actor_id UUID,
  
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  
  old_data JSONB,
  new_data JSONB,
  
  ip_address VARCHAR(50),
  user_agent TEXT,
  
  session_id VARCHAR(100)
);

-- ============================================
-- VIEWS
-- ============================================

-- Case Summary View (for listings)
CREATE VIEW case_summary AS
SELECT 
  c.id,
  c.case_id,
  c.status,
  c.sale_price_mxn,
  c.plan_name,
  c.created_at,
  c.updated_at,
  
  -- Unit info
  u.manzana,
  u.lot,
  u.surface_m2,
  
  -- Client info
  cl.full_name as buyer_name,
  cl.full_name_secondary as buyer_name_2,
  cl.email_primary as buyer_email,
  
  -- Broker
  c.broker_name,
  
  -- Calculated fields
  COALESCE(
    (SELECT SUM(p.amount_mxn) FROM payments p WHERE p.case_id = c.id),
    0
  ) as total_paid_mxn,
  
  c.sale_price_mxn - COALESCE(
    (SELECT SUM(p.amount_mxn) FROM payments p WHERE p.case_id = c.id),
    0
  ) as balance_mxn,
  
  (SELECT MIN(ps.due_date) 
   FROM payment_schedule ps 
   WHERE ps.case_id = c.id 
     AND ps.status IN ('pending', 'partial')
     AND ps.due_date >= CURRENT_DATE
  ) as next_due_date,
  
  (SELECT SUM(ps.amount_mxn - ps.paid_amount_mxn)
   FROM payment_schedule ps 
   WHERE ps.case_id = c.id 
     AND ps.due_date < CURRENT_DATE
     AND ps.status IN ('pending', 'partial', 'overdue')
  ) as overdue_amount_mxn

FROM cases c
LEFT JOIN units u ON c.unit_id = u.id
LEFT JOIN clients cl ON c.client_id = cl.id;

-- Payment Summary by Case
CREATE VIEW payment_summary AS
SELECT 
  c.id as case_id,
  c.case_id as case_number,
  c.sale_price_mxn,
  
  -- Down payment totals
  COALESCE(SUM(CASE WHEN p.payment_type IN ('reserva', 'enganche') THEN p.amount_mxn END), 0) as down_paid_mxn,
  
  -- Monthly totals
  COALESCE(SUM(CASE WHEN p.payment_type = 'mensualidad' THEN p.amount_mxn END), 0) as monthly_paid_mxn,
  
  -- Total
  COALESCE(SUM(p.amount_mxn), 0) as total_paid_mxn,
  
  -- Balance
  c.sale_price_mxn - COALESCE(SUM(p.amount_mxn), 0) as balance_mxn,
  
  -- Count
  COUNT(p.id) as payment_count,
  MAX(p.payment_date) as last_payment_date

FROM cases c
LEFT JOIN payments p ON p.case_id = c.id
GROUP BY c.id, c.case_id, c.sale_price_mxn;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_cases_case_id ON cases(case_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_unit_id ON cases(unit_id);
CREATE INDEX idx_cases_client_id ON cases(client_id);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);

CREATE INDEX idx_payments_case_id ON payments(case_id);
CREATE INDEX idx_payments_date ON payments(payment_date DESC);
CREATE INDEX idx_payments_type ON payments(payment_type);
CREATE INDEX idx_payments_audit_id ON payments(audit_id);

CREATE INDEX idx_schedule_case_id ON payment_schedule(case_id);
CREATE INDEX idx_schedule_due_date ON payment_schedule(due_date);
CREATE INDEX idx_schedule_status ON payment_schedule(status);

CREATE INDEX idx_units_manzana_lot ON units(manzana, lot);
CREATE INDEX idx_units_status ON units(status);

CREATE INDEX idx_clients_email ON clients(email_primary);
CREATE INDEX idx_clients_name ON clients(full_name);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_ts ON audit_log(ts DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Generate next case ID
CREATE OR REPLACE FUNCTION generate_case_id()
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  new_id VARCHAR;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(case_id FROM 'MANA88-AK-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM cases;
  
  new_id := 'MANA88-AK-' || LPAD(next_num::TEXT, 4, '0');
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_schedule_updated_at
  BEFORE UPDATE ON payment_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit trigger for cases
CREATE OR REPLACE FUNCTION audit_case_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, old_data, new_data, actor)
  VALUES (
    TG_OP,
    'case',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) END,
    current_setting('app.current_user', TRUE)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_cases
  AFTER INSERT OR UPDATE OR DELETE ON cases
  FOR EACH ROW EXECUTE FUNCTION audit_case_changes();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

-- Staff can read all (using JWT email claim)
CREATE POLICY "Staff can view cases" ON cases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE email = auth.jwt() ->> 'email' 
        AND is_active = TRUE
    )
  );

CREATE POLICY "Staff can view payments" ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE email = auth.jwt() ->> 'email' 
        AND is_active = TRUE
    )
  );

-- Admin/Finance can modify
CREATE POLICY "Admin/Finance can modify cases" ON cases
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE email = auth.jwt() ->> 'email' 
        AND is_active = TRUE 
        AND role IN ('admin', 'finance')
    )
  );

CREATE POLICY "Admin/Finance can modify payments" ON payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE email = auth.jwt() ->> 'email' 
        AND is_active = TRUE 
        AND role IN ('admin', 'finance')
    )
  );

-- Units read-only for most staff
CREATE POLICY "Staff can view units" ON units
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE email = auth.jwt() ->> 'email' 
        AND is_active = TRUE
    )
  );

CREATE POLICY "Admin can modify units" ON units
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE email = auth.jwt() ->> 'email' 
        AND is_active = TRUE 
        AND role = 'admin'
    )
  );

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default staff (Corey as admin)
INSERT INTO staff (email, full_name, role, is_active, is_approver)
VALUES 
  ('corey@manaakumal.com', 'Corey Mangold', 'admin', TRUE, TRUE),
  ('finance@manaakumal.com', 'Finance Team', 'finance', TRUE, TRUE);

-- Insert manzanas/blocks as units (to be populated from actual inventory)
-- Example: INSERT INTO units (manzana, lot, status) VALUES ('C4', '1', 'available');

COMMENT ON TABLE cases IS 'Master sales case records - one per property sale';
COMMENT ON TABLE payments IS 'All financial transactions related to cases';
COMMENT ON TABLE payment_schedule IS 'Expected payment schedule for each case';
COMMENT ON TABLE payment_allocations IS 'How each payment is allocated across schedule items';
COMMENT ON COLUMN cases.schedule_raw IS 'JSONB array preserving legacy schedule format for compatibility';
COMMENT ON COLUMN payments.amount_mxn IS 'Amount in Mexican Pesos with centavo precision (2 decimals)';
