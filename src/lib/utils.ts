// Utility functions for MANA88 CMS

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with Tailwind merge support
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in Mexican Pesos
 * Preserves centavo precision
 */
export function formatMXN(amount: number | null | undefined): string {
  if (amount == null) return 'MX$0.00';
  
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format as compact currency (e.g., MX$1.2M)
 */
export function formatMXNCompact(amount: number | null | undefined): string {
  if (amount == null) return 'MX$0';
  
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

/**
 * Format date in Spanish (Mexico) locale
 */
export function formatDate(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

/**
 * Format date and time
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "hace 2 días")
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return rtf.format(-diffMinutes, 'minute');
    }
    return rtf.format(-diffHours, 'hour');
  }
  if (diffDays < 30) {
    return rtf.format(-diffDays, 'day');
  }
  if (diffDays < 365) {
    const diffMonths = Math.floor(diffDays / 30);
    return rtf.format(-diffMonths, 'month');
  }
  const diffYears = Math.floor(diffDays / 365);
  return rtf.format(-diffYears, 'year');
}

/**
 * Case status labels in Spanish
 */
export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  contract_generated: 'Contrato Generado',
  executed: 'Ejecutado',
  cancelled: 'Cancelado',
  on_hold: 'En Espera',
};

/**
 * Payment type labels in Spanish
 */
export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  reserva: 'Reserva',
  enganche: 'Enganche',
  mensualidad: 'Mensualidad',
  entrega: 'Entrega (10%)',
  balloon: 'Pago Balloon',
  adjustment: 'Ajuste',
  refund: 'Reembolso',
};

/**
 * Schedule status labels
 */
export const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  partial: 'Parcial',
  overdue: 'Vencido',
  waived: 'Dispensado',
};

/**
 * Status color classes for badges
 */
export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-blue-100 text-blue-800',
  contract_generated: 'bg-purple-100 text-purple-800',
  executed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  on_hold: 'bg-gray-100 text-gray-800',
};

/**
 * Payment status color classes
 */
export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-orange-100 text-orange-800',
  overdue: 'bg-red-100 text-red-800',
  waived: 'bg-gray-100 text-gray-800',
};

/**
 * Calculate percentage
 */
export function calculatePercentage(partial: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((partial / total) * 100);
}

/**
 * Parse amount from string (handles MXN format)
 */
export function parseAmount(value: string): number {
  if (!value) return 0;
  // Remove currency symbols, commas, and spaces
  const cleaned = value.replace(/[MX$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Generate case ID from sequence
 */
export function generateCaseId(sequence: number): string {
  return `MANA88-AK-${String(sequence).padStart(4, '0')}`;
}

/**
 * Extract manzana and lot from string like "C4-23" or "Manzana C4 Lote 23"
 */
export function parseManzanaLot(input: string): { manzana: string; lot: string } | null {
  // Try "C4-23" format
  const dashMatch = input.match(/^(C-?\d+)-(\d+)$/i);
  if (dashMatch) {
    return { manzana: dashMatch[1].toUpperCase(), lot: dashMatch[2] };
  }
  
  // Try "Manzana C4 Lote 23" format
  const fullMatch = input.match(/manzana\s*(C-?\d+).*?lote?\s*(\d+)/i);
  if (fullMatch) {
    return { manzana: fullMatch[1].toUpperCase(), lot: fullMatch[2] };
  }
  
  return null;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
