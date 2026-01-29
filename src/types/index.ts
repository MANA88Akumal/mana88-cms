// MANA88 CMS Type Definitions
// These types mirror the Supabase/PostgreSQL schema

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

export type ScheduleStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'waived';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type StaffRole = 'admin' | 'finance' | 'legal' | 'broker' | 'viewer';

// ============================================
// DATABASE MODELS
// ============================================

export interface Unit {
  id: string;
  manzana: string;
  lot: string;
  surface_m2: number | null;
  list_price_mxn: number | null;
  current_price_mxn: number | null;
  status: UnitStatus;
  property_type: string;
  folder_path: string | null;
  chepina_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  // Primary buyer
  full_name: string;
  email_primary: string | null;
  phone_primary: string | null;
  // Secondary buyer
  full_name_secondary: string | null;
  email_secondary: string | null;
  phone_secondary: string | null;
  // Address
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  // Documents
  nationality: string | null;
  id_document_url: string | null;
  proof_of_address_url: string | null;
  // Metadata
  is_llc: boolean;
  llc_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  case_id: string; // MANA88-AK-0001 format
  unit_id: string | null;
  client_id: string | null;
  
  // Pricing
  list_price_mxn: number | null;
  sale_price_mxn: number;
  discount_pct: number | null;
  
  // Payment Plan
  plan_name: string | null;
  down_payment_pct: number | null;
  down_payment_mxn: number | null;
  monthly_payment_count: number | null;
  monthly_payment_amount: number | null;
  final_payment_pct: number | null;
  final_payment_mxn: number | null;
  
  // Broker
  broker_name: string | null;
  broker_agency: string | null;
  broker_email: string | null;
  broker_phone: string | null;
  broker_commission_pct: number | null;
  
  // Status
  status: CaseStatus;
  
  // Documents
  offer_doc_url: string | null;
  offer_pdf_url: string | null;
  contract_doc_url: string | null;
  contract_pdf_url: string | null;
  folder_url: string | null;
  
  // Timeline
  contract_drafted_at: string | null;
  sent_for_signature_at: string | null;
  executed_at: string | null;
  delivery_date: string | null;
  
  // Legal
  assigned_legal_owner: string | null;
  
  // Schedule
  schedule_raw: ScheduleItem[] | null;
  
  // Legacy
  dto_json: LegacyDTO | null;
  dp_payments_json: unknown | null;
  custom_payments_json: unknown | null;
  
  // Metadata
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentSchedule {
  id: string;
  case_id: string;
  schedule_index: number;
  payment_type: PaymentType;
  label: string | null;
  amount_mxn: number;
  due_date: string;
  status: ScheduleStatus;
  paid_amount_mxn: number;
  paid_at: string | null;
  date_calculated: boolean;
  date_calculated_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  case_id: string;
  client_id: string | null;
  
  // Payment Details
  payment_date: string;
  payment_month: string | null;
  amount_mxn: number;
  amount_original: number | null;
  currency_original: string;
  fx_rate_used: number | null;
  
  // Classification
  payment_type: PaymentType;
  applied_to_installment: number | null;
  schedule_id: string | null;
  
  // Proof Documents
  mana_proof_url: string | null;
  client_proof_url: string | null;
  receipt_pdf_url: string | null;
  
  // Transaction Details
  channel: string | null;
  reference_number: string | null;
  bank_name: string | null;
  
  // Tracking
  entered_by: string | null;
  source: string | null;
  
  // Notes
  notes: string | null;
  
  // Audit
  audit_id: string;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  
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
// VIEW TYPES (Computed/Joined)
// ============================================

export interface CaseSummary extends Case {
  // From units
  manzana: string | null;
  lot: string | null;
  surface_m2: number | null;
  
  // From clients
  buyer_name: string | null;
  buyer_name_2: string | null;
  buyer_email: string | null;
  
  // Calculated
  total_paid_mxn: number;
  balance_mxn: number;
  next_due_date: string | null;
  overdue_amount_mxn: number | null;
}

export interface PaymentSummary {
  case_id: string;
  case_number: string;
  sale_price_mxn: number;
  down_paid_mxn: number;
  monthly_paid_mxn: number;
  total_paid_mxn: number;
  balance_mxn: number;
  payment_count: number;
  last_payment_date: string | null;
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

export interface CreateCaseRequest {
  unit_id?: string;
  manzana: string;
  lot: string;
  
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
  
  // Broker
  broker_name?: string;
  broker_agency?: string;
  broker_email?: string;
  broker_phone?: string;
  
  // Schedule
  schedule: ScheduleItem[];
  
  notes?: string;
}

export interface RecordPaymentRequest {
  case_id: string;
  payment_date: string;
  amount_mxn: number;
  payment_type: PaymentType;
  applied_to_installment?: number;
  channel?: string;
  reference_number?: string;
  notes?: string;
  mana_proof_url?: string;
  client_proof_url?: string;
}

export interface FinanceReportFilters {
  from_date?: string;
  to_date?: string;
  status?: CaseStatus;
  manzana?: string;
  broker?: string;
}

export interface FinanceReportRow {
  case_id: string;
  case_number: string;
  buyer_name: string;
  manzana: string;
  lot: string;
  plan_name: string;
  sale_price_mxn: number;
  total_paid_mxn: number;
  balance_mxn: number;
  next_due_date: string | null;
  overdue_amount_mxn: number;
  status: CaseStatus;
}

// ============================================
// UI/FORM TYPES
// ============================================

export interface CaseFormData {
  manzana: string;
  lot: string;
  buyer1Name: string;
  buyer2Name?: string;
  email1?: string;
  email2?: string;
  phone1?: string;
  phone2?: string;
  listPrice?: number;
  salePrice: number;
  planName: string;
  downPaymentPct?: number;
  downPaymentMxn?: number;
  monthlyPayments?: number;
  monthlyAmount?: number;
  brokerName?: string;
  brokerAgency?: string;
  brokerEmail?: string;
  brokerPhone?: string;
  notes?: string;
}

export interface PaymentFormData {
  caseId: string;
  paymentDate: Date;
  amountMxn: number;
  paymentType: PaymentType;
  appliedToInstallment?: number;
  channel?: string;
  referenceNumber?: string;
  notes?: string;
  proofFile?: File;
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
