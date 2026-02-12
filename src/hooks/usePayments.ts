// Payment-related React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { caseKeys } from './useCases';
import type {
  Payment,
  PaymentType,
  PaymentScheduleItem,
  RecordPaymentInput,
  GenerateScheduleInput,
} from '../types';

// Re-export types for backwards compatibility
export type { Payment, PaymentType, PaymentScheduleItem };
export type { ScheduleStatus, PaymentChannel } from '../types';

// Query keys
export const paymentKeys = {
  all: ['payments'] as const,
  byCase: (caseId: string) => [...paymentKeys.all, 'case', caseId] as const,
  schedule: (caseId: string) => [...paymentKeys.all, 'schedule', caseId] as const,
  recent: () => [...paymentKeys.all, 'recent'] as const,
};

// ============================================
// QUERIES
// ============================================

export function usePayments(caseUuid: string) {
  return useQuery({
    queryKey: paymentKeys.byCase(caseUuid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cms_payments')
        .select('*')
        .eq('case_id', caseUuid)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!caseUuid,
  });
}

export function usePaymentSchedule(caseUuid: string) {
  return useQuery({
    queryKey: paymentKeys.schedule(caseUuid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_schedule')
        .select('*')
        .eq('case_id', caseUuid)
        .order('schedule_index');

      if (error) throw error;
      return data as PaymentScheduleItem[];
    },
    enabled: !!caseUuid,
  });
}

export function useRecentPayments(limit = 10) {
  return useQuery({
    queryKey: paymentKeys.recent(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cms_payments')
        .select(`
          *,
          case:cases!inner(case_id, client:clients(full_name))
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
  });
}

export function usePaymentStats() {
  return useQuery({
    queryKey: ['payments', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cms_payments')
        .select('amount_mxn, payment_type');

      if (error) throw error;

      const total = data?.reduce((sum, p) => {
        if (p.payment_type === 'refund') return sum - p.amount_mxn;
        return sum + p.amount_mxn;
      }, 0) || 0;

      return {
        totalCollected: total,
        paymentCount: data?.length || 0,
      };
    },
  });
}

export function useOverduePayments() {
  return useQuery({
    queryKey: ['payments', 'overdue'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('payment_schedule')
        .select(`
          *,
          case:cases!inner(case_id, client:clients(full_name))
        `)
        .in('status', ['pending', 'partial'])
        .lt('due_date', today)
        .order('due_date');

      if (error) throw error;
      return data;
    },
  });
}

// ============================================
// MUTATIONS
// ============================================

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      const { data: payment, error: paymentError } = await supabase
        .from('cms_payments')
        .insert({
          case_id: input.case_id,
          schedule_id: input.schedule_id,
          payment_date: input.payment_date,
          amount_mxn: input.amount_mxn,
          payment_type: input.payment_type,
          channel: input.channel,
          reference: input.reference,
          proof_url_client: input.proof_url_client,
          notes: input.notes,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      if (input.schedule_id) {
        const { data: scheduleItem } = await supabase
          .from('payment_schedule')
          .select('*')
          .eq('id', input.schedule_id)
          .single();

        if (scheduleItem) {
          const newPaidAmount = (scheduleItem.paid_amount_mxn || 0) + input.amount_mxn;
          const isPaid = newPaidAmount >= scheduleItem.amount_mxn;

          await supabase
            .from('payment_schedule')
            .update({
              paid_amount_mxn: newPaidAmount,
              paid_date: input.payment_date,
              status: isPaid ? 'paid' : 'partial',
            })
            .eq('id', input.schedule_id);
        }
      }

      return payment;
    },
    onSuccess: (_, { case_id }) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.byCase(case_id) });
      queryClient.invalidateQueries({ queryKey: paymentKeys.schedule(case_id) });
      queryClient.invalidateQueries({ queryKey: paymentKeys.recent() });
      queryClient.invalidateQueries({ queryKey: ['payments', 'stats'] });
    },
  });
}

export function useGenerateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateScheduleInput) => {
      const scheduleItems: Partial<PaymentScheduleItem>[] = [];
      let index = 0;

      scheduleItems.push({
        case_id: input.case_id,
        schedule_index: index++,
        payment_type: 'reserva',
        label: 'Reserva',
        amount_mxn: input.reservation.amount,
        due_date: input.reservation.date,
        status: 'pending',
        paid_amount_mxn: 0,
      });

      if (input.down_payment) {
        scheduleItems.push({
          case_id: input.case_id,
          schedule_index: index++,
          payment_type: 'enganche',
          label: 'Enganche',
          amount_mxn: input.down_payment.amount,
          due_date: input.down_payment.date,
          status: 'pending',
          paid_amount_mxn: 0,
        });
      }

      if (input.monthly && input.monthly.count > 0) {
        const startDate = new Date(input.monthly.start_date);
        for (let i = 0; i < input.monthly.count; i++) {
          const dueDate = new Date(startDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          scheduleItems.push({
            case_id: input.case_id,
            schedule_index: index++,
            payment_type: 'mensualidad',
            label: `Mensualidad ${i + 1}`,
            amount_mxn: input.monthly.amount,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending',
            paid_amount_mxn: 0,
          });
        }
      }

      if (input.final) {
        scheduleItems.push({
          case_id: input.case_id,
          schedule_index: index++,
          payment_type: 'entrega',
          label: 'Entrega (10%)',
          amount_mxn: input.final.amount,
          due_date: input.final.date,
          status: 'pending',
          paid_amount_mxn: 0,
        });
      }

      const { data, error } = await supabase
        .from('payment_schedule')
        .insert(scheduleItems)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { case_id }) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.schedule(case_id) });
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(case_id) });
    },
  });
}

// Helper: calculate payment totals from payments array
export function calculatePaymentTotals(payments: Payment[], schedule?: PaymentScheduleItem[]) {
  const totalScheduled = schedule?.reduce((sum, item) => sum + item.amount_mxn, 0) || 0;
  const totalPaid = payments
    .filter(p => p.payment_type !== 'refund')
    .reduce((sum, p) => sum + p.amount_mxn, 0);
  const totalRefunded = payments
    .filter(p => p.payment_type === 'refund')
    .reduce((sum, p) => sum + p.amount_mxn, 0);
  const balance = totalScheduled - totalPaid + totalRefunded;
  const percentPaid = totalScheduled > 0 ? (totalPaid / totalScheduled) * 100 : 0;

  return {
    totalScheduled,
    totalPaid,
    totalRefunded,
    balance,
    percentPaid: Math.round(percentPaid * 100) / 100,
  };
}

// Alias for backwards compatibility
export const usePaymentsByCase = usePayments;
