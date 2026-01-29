// Case-related React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Query keys for cache management
export const caseKeys = {
  all: ['cases'] as const,
  lists: () => [...caseKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...caseKeys.lists(), filters] as const,
  details: () => [...caseKeys.all, 'detail'] as const,
  detail: (id: string) => [...caseKeys.details(), id] as const,
};

// Types
export type CaseStatus = 'pending' | 'active' | 'contract_generated' | 'executed' | 'cancelled' | 'on_hold';

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
  contract_pdf_url: string | null;
  folder_url: string | null;
  offer_date: string | null;
  executed_at: string | null;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LotRecord {
  id: number;
  lot_number: string;
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

export interface PaymentScheduleRecord {
  id: string;
  case_id: string;
  schedule_index: number;
  payment_type: string;
  label: string | null;
  amount_mxn: number;
  due_date: string;
  status: string;
  paid_amount_mxn: number;
  paid_date: string | null;
}

export interface PaymentRecord {
  id: string;
  case_id: string;
  payment_date: string;
  amount_mxn: number;
  payment_type: string;
  channel: string | null;
  reference: string | null;
  proof_url_client: string | null;
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
}

// ============================================
// QUERIES
// ============================================

interface UseCasesOptions {
  status?: CaseStatus;
  manzana?: string;
  search?: string;
}

export function useCases(options: UseCasesOptions = {}) {
  const { status, manzana, search } = options;
  
  return useQuery({
    queryKey: caseKeys.list({ status, manzana, search }),
    queryFn: async () => {
      let query = supabase
        .from('cases')
        .select(`
          *,
          lot:lots!left(id, lot_number, manzana, phase, area_m2, status, full_retail_value_mxn),
          client:clients!left(id, full_name, email, phone, is_llc, llc_name),
          broker:brokers!left(id, full_name, agency, email)
        `)
        .order('updated_at', { ascending: false });
      
      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }
      if (search) {
        query = query.or(`case_id.ilike.%${search}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Filter by manzana if provided (need to filter after join)
      let filtered = data || [];
      if (manzana) {
        filtered = filtered.filter((c: any) => c.lot?.manzana === manzana);
      }
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter((c: any) => 
          c.case_id?.toLowerCase().includes(searchLower) ||
          c.client?.full_name?.toLowerCase().includes(searchLower) ||
          c.lot?.lot_number?.toLowerCase().includes(searchLower)
        );
      }
      
      return filtered;
    },
  });
}

export function useCase(caseId: string) {
  return useQuery({
    queryKey: caseKeys.detail(caseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          lot:lots!left(*),
          client:clients!left(*),
          broker:brokers!left(*)
        `)
        .eq('case_id', caseId)
        .single();
      
      if (error) throw error;
      
      // Fetch payment schedule
      const { data: schedule } = await supabase
        .from('payment_schedule')
        .select('*')
        .eq('case_id', data.id)
        .order('schedule_index');
      
      // Fetch payments
      const { data: payments } = await supabase
        .from('cms_payments')
        .select('*')
        .eq('case_id', data.id)
        .order('payment_date', { ascending: false });
      
      return {
        ...data,
        schedule: schedule || [],
        payments: payments || [],
      };
    },
    enabled: !!caseId,
  });
}

// Get available lots (not sold)
export function useAvailableLots(manzana?: string) {
  return useQuery({
    queryKey: ['lots', 'available', manzana],
    queryFn: async () => {
      let query = supabase
        .from('lots')
        .select('*')
        .eq('status', 'Available')
        .order('manzana')
        .order('lot_number');
      
      if (manzana) {
        query = query.eq('manzana', manzana);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as LotRecord[];
    },
  });
}

// Get all manzanas
export function useManzanas() {
  return useQuery({
    queryKey: ['manzanas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lots')
        .select('manzana')
        .order('manzana');
      
      if (error) throw error;
      
      // Get unique manzanas
      const unique = [...new Set(data?.map(d => d.manzana) || [])];
      return unique;
    },
  });
}

// Get pending approvals count
export function usePendingApprovalsCount() {
  return useQuery({
    queryKey: ['approvals', 'pending', 'count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('approvals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (error) throw error;
      return count || 0;
    },
  });
}

// ============================================
// MUTATIONS
// ============================================

interface CreateCaseInput {
  lot_id: number;
  client: {
    full_name: string;
    email?: string;
    phone?: string;
    full_name_secondary?: string;
    is_llc?: boolean;
    llc_name?: string;
  };
  broker?: {
    full_name: string;
    agency?: string;
    email?: string;
    phone?: string;
  };
  sale_price_mxn: number;
  plan_name: string;
  reservation_mxn?: number;
  down_payment_pct?: number;
  down_payment_mxn?: number;
  monthly_count?: number;
  monthly_amount_mxn?: number;
  final_payment_pct?: number;
  final_payment_mxn?: number;
  broker_commission_pct?: number;
  notes?: string;
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateCaseInput) => {
      // 1. Create or find client
      let clientId: string;
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('email', input.client.email)
        .single();
      
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert(input.client)
          .select('id')
          .single();
        
        if (clientError) throw clientError;
        clientId = newClient.id;
      }
      
      // 2. Create or find broker if provided
      let brokerId: string | null = null;
      if (input.broker?.full_name) {
        const { data: existingBroker } = await supabase
          .from('brokers')
          .select('id')
          .eq('email', input.broker.email)
          .single();
        
        if (existingBroker) {
          brokerId = existingBroker.id;
        } else {
          const { data: newBroker, error: brokerError } = await supabase
            .from('brokers')
            .insert(input.broker)
            .select('id')
            .single();
          
          if (brokerError) throw brokerError;
          brokerId = newBroker.id;
        }
      }
      
      // 3. Generate case ID
      const { data: caseIdData, error: seqError } = await supabase
        .rpc('generate_case_id');
      
      if (seqError) throw seqError;
      const caseId = caseIdData;
      
      // 4. Create case
      const { data: newCase, error: caseError } = await supabase
        .from('cases')
        .insert({
          case_id: caseId,
          lot_id: input.lot_id,
          client_id: clientId,
          broker_id: brokerId,
          sale_price_mxn: input.sale_price_mxn,
          plan_name: input.plan_name,
          reservation_mxn: input.reservation_mxn || 50000,
          down_payment_pct: input.down_payment_pct,
          down_payment_mxn: input.down_payment_mxn,
          monthly_count: input.monthly_count,
          monthly_amount_mxn: input.monthly_amount_mxn,
          final_payment_pct: input.final_payment_pct || 10,
          final_payment_mxn: input.final_payment_mxn,
          broker_commission_pct: input.broker_commission_pct,
          notes: input.notes,
          status: 'pending',
        })
        .select()
        .single();
      
      if (caseError) throw caseError;
      
      // 5. Update lot status to reserved
      await supabase
        .from('lots')
        .update({ status: 'Reserved' })
        .eq('id', input.lot_id);
      
      return newCase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.all });
      queryClient.invalidateQueries({ queryKey: ['lots'] });
    },
  });
}

export function useUpdateCaseStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ caseId, status }: { caseId: string; status: CaseStatus }) => {
      const { data, error } = await supabase
        .from('cases')
        .update({ status })
        .eq('case_id', caseId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() });
    },
  });
}

// Dashboard stats
export function useCaseStats() {
  return useQuery({
    queryKey: ['cases', 'stats'],
    queryFn: async () => {
      const { data: cases, error } = await supabase
        .from('cases')
        .select('status, sale_price_mxn');
      
      if (error) throw error;
      
      const stats = {
        total: cases?.length || 0,
        pending: cases?.filter(c => c.status === 'pending').length || 0,
        active: cases?.filter(c => c.status === 'active').length || 0,
        executed: cases?.filter(c => c.status === 'executed').length || 0,
        cancelled: cases?.filter(c => c.status === 'cancelled').length || 0,
        totalSalesValue: cases?.reduce((sum, c) => sum + (c.sale_price_mxn || 0), 0) || 0,
      };
      
      return stats;
    },
  });
}

// Alias for backwards compatibility
export const useLotsByManzana = useAvailableLots;
