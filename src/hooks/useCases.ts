// Case-related React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  CaseStatus,
  CaseRecord,
  LotRecord,
  ClientRecord,
  BrokerRecord,
  CreateCaseInput,
} from '../types';

// Re-export types for backwards compatibility
export type { CaseStatus, CaseRecord, LotRecord, ClientRecord, BrokerRecord };

// Query keys for cache management
export const caseKeys = {
  all: ['cases'] as const,
  lists: () => [...caseKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...caseKeys.lists(), filters] as const,
  details: () => [...caseKeys.all, 'detail'] as const,
  detail: (id: string) => [...caseKeys.details(), id] as const,
};

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

      if (status) {
        query = query.eq('status', status);
      }
      if (search) {
        query = query.or(`case_id.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let filtered = data || [] as any[];
      if (manzana) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filtered = filtered.filter((c: any) => c.lot?.manzana === manzana);
      }
      if (search) {
        const searchLower = search.toLowerCase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      const { data: schedule } = await supabase
        .from('payment_schedule')
        .select('*')
        .eq('case_id', data.id)
        .order('schedule_index');

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
      return (data || []).map(d => ({ ...d, lot: d.lot_number })) as LotRecord[];
    },
  });
}

export function useManzanas() {
  return useQuery({
    queryKey: ['manzanas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lots')
        .select('manzana')
        .order('manzana');

      if (error) throw error;
      const unique = [...new Set(data?.map(d => d.manzana) || [])];
      return unique;
    },
  });
}

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

export function useCreateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCaseInput) => {
      // 1. Resolve lot_id
      let lotId = input.lot_id;
      if (!lotId && input.manzana && input.lot) {
        const { data: lotData } = await supabase
          .from('lots')
          .select('id')
          .eq('manzana', input.manzana)
          .eq('lot_number', input.lot)
          .single();

        if (lotData) lotId = lotData.id;
      }

      // 2. Create or find client
      let clientId: string | null = null;
      if (input.buyer_name) {
        if (input.buyer_email) {
          const { data: existing } = await supabase
            .from('clients')
            .select('id')
            .eq('email', input.buyer_email)
            .single();
          if (existing) clientId = existing.id;
        }

        if (!clientId) {
          const { data: newClient, error } = await supabase
            .from('clients')
            .insert({
              full_name: input.buyer_name,
              email: input.buyer_email || null,
              phone: input.buyer_phone || null,
              full_name_secondary: input.buyer_name_2 || null,
            })
            .select('id')
            .single();
          if (error) throw error;
          clientId = newClient.id;
        }
      }

      // 3. Create or find broker
      let brokerId: string | null = null;
      if (input.broker_name) {
        if (input.broker_email) {
          const { data: existing } = await supabase
            .from('brokers')
            .select('id')
            .eq('email', input.broker_email)
            .single();
          if (existing) brokerId = existing.id;
        }

        if (!brokerId) {
          const { data: newBroker, error } = await supabase
            .from('brokers')
            .insert({
              full_name: input.broker_name,
              agency: input.broker_agency || null,
              email: input.broker_email || null,
              phone: input.broker_phone || null,
            })
            .select('id')
            .single();
          if (error) throw error;
          brokerId = newBroker.id;
        }
      }

      // 4. Generate case ID
      const { data: caseIdData, error: seqError } = await supabase.rpc('generate_case_id');
      if (seqError) throw seqError;

      // 5. Create case
      const { data: newCase, error: caseError } = await supabase
        .from('cases')
        .insert({
          case_id: caseIdData,
          lot_id: lotId,
          client_id: clientId,
          broker_id: brokerId,
          list_price_mxn: input.list_price_mxn,
          sale_price_mxn: input.sale_price_mxn,
          plan_name: input.plan_name,
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

      // 6. Reserve the lot
      if (lotId) {
        await supabase.from('lots').update({ status: 'Reserved' }).eq('id', lotId);
      }

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

export function useCaseStats() {
  return useQuery({
    queryKey: ['cases', 'stats'],
    queryFn: async () => {
      const { data: cases, error } = await supabase
        .from('cases')
        .select('status, sale_price_mxn');

      if (error) throw error;

      return {
        total: cases?.length || 0,
        pending: cases?.filter(c => c.status === 'pending').length || 0,
        active: cases?.filter(c => c.status === 'active').length || 0,
        executed: cases?.filter(c => c.status === 'executed').length || 0,
        cancelled: cases?.filter(c => c.status === 'cancelled').length || 0,
        totalSalesValue: cases?.reduce((sum, c) => sum + (c.sale_price_mxn || 0), 0) || 0,
      };
    },
  });
}

// Aliases for backwards compatibility
export const useLotsByManzana = useAvailableLots;
