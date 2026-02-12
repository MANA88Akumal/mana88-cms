// MANA88 CMS Type Definitions
// Single source of truth — all hooks and pages import from here

// ============================================
// ENUMS
// ============================================

export type UnitStatus = 'available' | 'reserved' | 'sold' | 'blocked';

export type CaseStatus =
  | 'pending'
  | 'active'
  | 'contract_generated'
  | 'executed'
  | 'cancelled'
  | 'on_hold';

export type PaymentType =
  | 'reserva'
  | 'enganche'
  | 'mensualidad'
  | 'entrega'
  | 'balloon'
  | 'adjustment'
  | 'refund';

export type PaymentChannel = 'transfer' | 'cash' | 'check' | 'credit_card' | 'other';

export type ScheduleStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'waived';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type StaffRole = 'admin' | 'finance' | 'legal' | 'broker' | 'viewer';

// ============================================
// DATABASE MODELS
// ============================================

export interface LotRecord {
  id: number;
  lot_number: string;
  lot: string; // alias for lot_number (mapped in hooks)
  manzana: string;
  phase: number;
  area_m2: number;
  status: string;
  full_retail_value_mxn: number | null;
  sale_price_mxn: number | null;
}

export interface ClientRecord {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  full_name_secondary: string | null;
  is_llc: boolean;
  llc_name: string | null;
}

export interface BrokerRecord {
  id: string;
  full_name: string;
  agency: string | null;
  email: string | null;
  phone: string | null;
}

export interface CaseRecord {
  id: string;
  case_id: string;
  lot_id: number | null;
  client_id: string | null;
  broker_id: string | null;
  list_price_mxn: number | null;
  sale_price_mxn: number;
  discount_pct: number | null;
  plan_name: string | null;
  reservation_mxn: number | null;
  down_payment_pct: number | null;
  down_payment_mxn: number | null;
  monthly_count: number | null;
  monthly_amount_mxn: number | null;
  final_payment_pct: number | null;
  final_payment_mxn: number | null;
  broker_commission_pct: number | null;
  broker_commission_mxn: number | null;
  status: CaseStatus;
  offer_doc_url: string | null;
  offer_pdf_url: string | null;
  contract_doc_url: string | null;
  contract_pdf_url: string | null;
  folder_url: string | null;
  offer_date: string | null;
  contract_drafted_at: string | null;
  sent_for_signature_at: string | null;
  executed_at: string | null;
  delivery_date: string | null;
  assigned_legal_owner: string | null;
  notes: string | null;
  version: number | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  case_id: string;
  client_id: string | null;
  schedule_id: string | null;

  // Amounts
  payment_date: string;
  payment_month: string | null;
  amount_mxn: number;
  amount_original: number | null;
  currency_original: string | null;
  fx_rate_used: number | null;

  // Classification
  payment_type: PaymentType;
  applied_to_installment: number | null;

  // Channel & reference
  channel: string | null;
  reference: string | null;
  reference_number: string | null;
  bank_name: string | null;

  // Proof documents
  mana_proof_url: string | null;
  proof_url_mana: string | null;
  client_proof_url: string | null;
  proof_url_client: string | null;
  receipt_number: string | null;
  receipt_url: string | null;
  receipt_pdf_url: string | null;

  // Tracking
  recorded_by: string | null;
  entered_by: string | null;
  source: string | null;
  notes: string | null;

  // Audit
  audit_id: string | null;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface PaymentScheduleItem {
  id: string;
  case_id: string;
  schedule_index: number;
  payment_type: PaymentType;
  label: string | null;
  amount_mxn: number;
  due_date: string;
  status: ScheduleStatus;
  paid_amount_mxn: number;
  paid_date: string | null;
  paid_at: string | null;
  date_calculated: boolean | null;
  date_calculated_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Approval {
  id: string;
  case_id: string;
  request_type: string | null;
  request_data: unknown | null;
  requested_by: string | null;
  requested_at: string;
  status: ApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Staff {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string | null;
  role: StaffRole;
  is_active: boolean;
  is_approver: boolean;
  department: string | null;
  phone: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  ts: string;
  actor: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_data: unknown | null;
  new_data: unknown | null;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
}

// ============================================
// VIEW TYPES (Computed/Joined from queries)
// ============================================

export interface CaseSummary extends CaseRecord {
  // Join objects (raw from Supabase)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lot?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  broker?: any;

  // Flattened convenience fields
  manzana?: string | null;
  lot_number?: string | null;
  surface_m2?: number | null;
  buyer_name?: string | null;
  buyer_name_2?: string | null;
  buyer_email?: string | null;
  broker_name?: string | null;
  broker_agency?: string | null;
  broker_email?: string | null;
  broker_phone?: string | null;

  // Calculated
  total_paid_mxn: number;
  balance_mxn?: number;
  next_due_date?: string | null;
  overdue_amount_mxn?: number | null;
}

// ============================================
// LEGACY DTO TYPES (For Migration)
// ============================================

export interface ScheduleItem {
  type: string;
  label: string;
  amount: number;
  date: string;
  dateCalculated?: boolean;
  dateCalculatedOn?: string;
}

export interface LegacyDTO {
  caseId: string;
  buyers: {
    b1: string;
    b2: string;
    idUrl?: string;
  };
  contacts: {
    email1: string;
    email2: string;
    phone1: string;
    phone2: string;
  };
  contract: {
    buyerAddress: string;
    buyerIdUrl?: string;
  };
  property: {
    lot: string;
    manzana: string;
    m2: string;
  };
  pricing: {
    list: number;
    sale: number;
  };
  plan: {
    name: string;
    downPct: number | string;
    downMx: number;
  };
  broker: {
    name: string;
    agency: string;
    email: string;
    phone: string;
  };
  scheduleRaw: ScheduleItem[];
  schedule?: Array<{
    type: string;
    label: string;
    amount: string;
    date: string;
  }>;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateCaseInput {
  // Property
  lot_id?: number;
  manzana?: string;
  lot?: string;

  // Client
  buyer_name: string;
  buyer_name_2?: string;
  buyer_email?: string;
  buyer_phone?: string;

  // Pricing
  list_price_mxn?: number;
  sale_price_mxn: number;

  // Plan
  plan_name: string;
  down_payment_pct?: number;
  down_payment_mxn?: number;
  monthly_count?: number;
  monthly_amount_mxn?: number;
  final_payment_pct?: number;
  final_payment_mxn?: number;

  // Broker
  broker_name?: string;
  broker_agency?: string;
  broker_email?: string;
  broker_phone?: string;
  broker_commission_pct?: number;

  // Schedule
  schedule?: ScheduleItem[];

  notes?: string;
}

export interface RecordPaymentInput {
  case_id: string;
  schedule_id?: string;
  payment_date: string;
  amount_mxn: number;
  payment_type: PaymentType;
  channel?: string;
  reference?: string;
  proof_url_client?: string;
  notes?: string;
}

export interface GenerateScheduleInput {
  case_id: string;
  reservation: { amount: number; date: string };
  down_payment?: { amount: number; date: string };
  monthly?: { amount: number; count: number; start_date: string };
  final?: { amount: number; date: string };
}

export interface FinanceReportFilters {
  from_date?: string;
  to_date?: string;
  status?: CaseStatus;
  manzana?: string;
  broker?: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export type SortDirection = 'asc' | 'desc';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}
