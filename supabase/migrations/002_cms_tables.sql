-- MANA88 CMS Tables Migration
-- Adds CMS-specific tables to existing investor-app Supabase project
-- Run this in Supabase SQL Editor

-- ============================================
-- UPDATE PROFILES TABLE FOR NEW ROLES
-- ============================================

-- Add system_access column to profiles if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS system_access JSONB DEFAULT '{"investor_portal": true}'::jsonb;

-- Add phone column if missing
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Update existing admin users to have full system access
UPDATE profiles 
SET system_access = '{"investor_portal": true, "cms": true, "cash": true}'::jsonb
WHERE role = 'admin';

-- ============================================
-- CLIENTS TABLE (Buyers - separate from profiles)
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Primary buyer
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Secondary buyer (co-buyer)
  full_name_secondary TEXT,
  email_secondary TEXT,
  phone_secondary TEXT,
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Mexico',
  postal_code TEXT,
  
  -- Identity documents
  nationality TEXT,
  rfc TEXT,
  curp TEXT,
  id_document_url TEXT,
  proof_of_address_url TEXT,
  
  -- If LLC
  is_llc BOOLEAN DEFAULT FALSE,
  llc_name TEXT,
  llc_rfc TEXT,
  
  -- Link to profile if client has login
  profile_id UUID REFERENCES profiles(id),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BROKERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Broker info
  full_name TEXT NOT NULL,
  agency TEXT,
  email TEXT,
  phone TEXT,
  
  -- Commission
  default_commission_pct NUMERIC(5,2) DEFAULT 5.00,
  
  -- Link to profile if broker has login
  profile_id UUID REFERENCES profiles(id),
  
  active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CASES TABLE (Sales/Offers)
-- ============================================
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT UNIQUE NOT NULL,  -- MANA88-AK-0001 format
  
  -- Foreign keys
  lot_id INTEGER REFERENCES lots(id),
  client_id UUID REFERENCES clients(id),
  broker_id UUID REFERENCES brokers(id),
  
  -- Pricing (in MXN centavos for precision, stored as numeric)
  list_price_mxn NUMERIC(14,2),
  sale_price_mxn NUMERIC(14,2) NOT NULL,
  discount_pct NUMERIC(5,2),
  
  -- Payment Plan
  plan_name TEXT,  -- '30/60/10', '90/10', 'Custom'
  reservation_mxn NUMERIC(14,2) DEFAULT 50000,
  down_payment_pct NUMERIC(5,2),
  down_payment_mxn NUMERIC(14,2),
  monthly_count INTEGER,
  monthly_amount_mxn NUMERIC(14,2),
  final_payment_pct NUMERIC(5,2) DEFAULT 10,
  final_payment_mxn NUMERIC(14,2),
  
  -- Broker commission
  broker_commission_pct NUMERIC(5,2),
  broker_commission_mxn NUMERIC(14,2),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'contract_generated', 'executed', 'cancelled', 'on_hold'
  )),
  
  -- Documents (Google Drive URLs)
  offer_doc_url TEXT,
  offer_pdf_url TEXT,
  contract_doc_url TEXT,
  contract_pdf_url TEXT,
  folder_url TEXT,
  
  -- Timeline
  offer_date DATE,
  contract_drafted_at TIMESTAMPTZ,
  sent_for_signature_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  delivery_date DATE,
  
  -- Assigned staff
  assigned_staff_id UUID REFERENCES profiles(id),
  
  -- Legacy migration data
  legacy_dto JSONB,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAYMENT SCHEDULE TABLE (Expected payments)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  
  schedule_index INTEGER NOT NULL,  -- 0, 1, 2, ...
  payment_type TEXT NOT NULL CHECK (payment_type IN (
    'reserva', 'enganche', 'mensualidad', 'entrega', 'balloon', 'adjustment'
  )),
  label TEXT,  -- "Reserva", "Enganche", "Mensualidad 1", etc.
  
  amount_mxn NUMERIC(14,2) NOT NULL,
  due_date DATE NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'paid', 'partial', 'overdue', 'waived'
  )),
  paid_amount_mxn NUMERIC(14,2) DEFAULT 0,
  paid_date DATE,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(case_id, schedule_index)
);

-- ============================================
-- PAYMENTS TABLE (Actual payments received)
-- ============================================
CREATE TABLE IF NOT EXISTS cms_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  schedule_id UUID REFERENCES payment_schedule(id),
  
  -- Payment details
  payment_date DATE NOT NULL,
  amount_mxn NUMERIC(14,2) NOT NULL,
  
  payment_type TEXT NOT NULL CHECK (payment_type IN (
    'reserva', 'enganche', 'mensualidad', 'entrega', 'balloon', 'adjustment', 'refund'
  )),
  
  -- Payment method
  channel TEXT CHECK (channel IN (
    'transfer', 'cash', 'check', 'credit_card', 'other'
  )),
  reference TEXT,  -- Transaction reference
  
  -- Proof of payment
  proof_url_mana TEXT,   -- MANA's bank statement
  proof_url_client TEXT, -- Client's transfer receipt
  
  -- Recorded by
  recorded_by UUID REFERENCES profiles(id),
  
  -- Receipt
  receipt_number TEXT,
  receipt_url TEXT,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- APPROVALS TABLE (Workflow)
-- ============================================
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  
  approval_type TEXT NOT NULL CHECK (approval_type IN (
    'new_case', 'contract', 'payment', 'amendment', 'cancellation'
  )),
  
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'cancelled'
  )),
  
  requested_by UUID REFERENCES profiles(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  
  notes TEXT,
  rejection_reason TEXT,
  
  -- Data snapshot at time of request
  request_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS cms_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  
  performed_by UUID REFERENCES profiles(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  
  ip_address TEXT,
  user_agent TEXT
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_lot_id ON cases(lot_id);
CREATE INDEX IF NOT EXISTS idx_cases_client_id ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_broker_id ON cases(broker_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_case_id ON payment_schedule(case_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_due_date ON payment_schedule(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_status ON payment_schedule(status);
CREATE INDEX IF NOT EXISTS idx_cms_payments_case_id ON cms_payments(case_id);
CREATE INDEX IF NOT EXISTS idx_cms_payments_date ON cms_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_approvals_case_id ON approvals(case_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_brokers_email ON brokers(email);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all CMS tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check CMS access
CREATE OR REPLACE FUNCTION has_cms_access()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (
      role IN ('admin', 'staff', 'finance', 'legal')
      OR (system_access->>'cms')::boolean = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is broker
CREATE OR REPLACE FUNCTION is_broker()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'broker'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is client
CREATE OR REPLACE FUNCTION is_client()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'client'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES
-- ============================================

-- CLIENTS: Staff can see all, clients can see themselves
CREATE POLICY "Staff can view all clients" ON clients
  FOR SELECT USING (has_cms_access());

CREATE POLICY "Staff can insert clients" ON clients
  FOR INSERT WITH CHECK (has_cms_access());

CREATE POLICY "Staff can update clients" ON clients
  FOR UPDATE USING (has_cms_access());

CREATE POLICY "Clients can view own record" ON clients
  FOR SELECT USING (profile_id = auth.uid());

-- BROKERS: Staff can see all, brokers can see themselves
CREATE POLICY "Staff can view all brokers" ON brokers
  FOR SELECT USING (has_cms_access());

CREATE POLICY "Staff can manage brokers" ON brokers
  FOR ALL USING (has_cms_access());

CREATE POLICY "Brokers can view own record" ON brokers
  FOR SELECT USING (profile_id = auth.uid());

-- CASES: Staff see all, brokers see their cases, clients see their cases
CREATE POLICY "Staff can view all cases" ON cases
  FOR SELECT USING (has_cms_access());

CREATE POLICY "Staff can manage cases" ON cases
  FOR ALL USING (has_cms_access());

CREATE POLICY "Brokers can view their cases" ON cases
  FOR SELECT USING (
    is_broker() AND broker_id IN (
      SELECT id FROM brokers WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view their cases" ON cases
  FOR SELECT USING (
    is_client() AND client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

-- PAYMENT_SCHEDULE: Same as cases
CREATE POLICY "Staff can view all schedules" ON payment_schedule
  FOR SELECT USING (has_cms_access());

CREATE POLICY "Staff can manage schedules" ON payment_schedule
  FOR ALL USING (has_cms_access());

CREATE POLICY "Clients can view their schedule" ON payment_schedule
  FOR SELECT USING (
    case_id IN (
      SELECT c.id FROM cases c
      JOIN clients cl ON c.client_id = cl.id
      WHERE cl.profile_id = auth.uid()
    )
  );

-- CMS_PAYMENTS: Same pattern
CREATE POLICY "Staff can view all payments" ON cms_payments
  FOR SELECT USING (has_cms_access());

CREATE POLICY "Staff can manage payments" ON cms_payments
  FOR ALL USING (has_cms_access());

CREATE POLICY "Clients can view their payments" ON cms_payments
  FOR SELECT USING (
    case_id IN (
      SELECT c.id FROM cases c
      JOIN clients cl ON c.client_id = cl.id
      WHERE cl.profile_id = auth.uid()
    )
  );

-- APPROVALS: Staff only
CREATE POLICY "Staff can view approvals" ON approvals
  FOR SELECT USING (has_cms_access());

CREATE POLICY "Staff can manage approvals" ON approvals
  FOR ALL USING (has_cms_access());

-- AUDIT LOG: Admin only
CREATE POLICY "Admin can view audit log" ON cms_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_brokers_updated_at
  BEFORE UPDATE ON brokers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payment_schedule_updated_at
  BEFORE UPDATE ON payment_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_cms_payments_updated_at
  BEFORE UPDATE ON cms_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_approvals_updated_at
  BEFORE UPDATE ON approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEQUENCE FOR CASE IDS
-- ============================================
CREATE SEQUENCE IF NOT EXISTS case_id_seq START 1;

CREATE OR REPLACE FUNCTION generate_case_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'MANA88-AK-' || LPAD(nextval('case_id_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
