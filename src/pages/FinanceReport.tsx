// Finance Report Page - Financial summary and reporting
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCases } from '../hooks/useCases';
import { formatMXN, formatMXNCompact, formatDate, STATUS_LABELS, STATUS_COLORS } from '../lib/utils';
import type { CaseSummary, CaseStatus } from '../types';

// Stat Card
function StatCard({ 
  label, 
  value, 
  subValue, 
  color = 'gray' 
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  color?: 'gray' | 'green' | 'blue' | 'red' | 'amber';
}) {
  const colorClasses = {
    gray: 'bg-gray-50',
    green: 'bg-green-50',
    blue: 'bg-blue-50',
    red: 'bg-red-50',
    amber: 'bg-amber-50',
  };
  const valueColorClasses = {
    gray: 'text-gray-900',
    green: 'text-green-600',
    blue: 'text-blue-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
  };

  return (
    <div className={`p-4 rounded-xl ${colorClasses[color]}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${valueColorClasses[color]}`}>{value}</p>
      {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
    </div>
  );
}

export function FinanceReport() {
  const { data: cases, isLoading, error } = useCases();
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<CaseStatus | ''>('');
  const [manzanaFilter, setManzanaFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // Get unique manzanas
  const manzanas = useMemo(() => {
    if (!cases) return [];
    return [...new Set(cases.map(c => c.manzana).filter(Boolean))].sort();
  }, [cases]);

  // Filter cases
  const filteredCases = useMemo(() => {
    if (!cases) return [];
    
    return cases.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (manzanaFilter && c.manzana !== manzanaFilter) return false;
      // Add date filtering if needed
      return true;
    });
  }, [cases, statusFilter, manzanaFilter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const activeCases = filteredCases.filter(c => c.status !== 'cancelled');
    
    return {
      totalCases: activeCases.length,
      totalSaleValue: activeCases.reduce((sum, c) => sum + (c.sale_price_mxn || 0), 0),
      totalCollected: activeCases.reduce((sum, c) => sum + (c.total_paid_mxn || 0), 0),
      totalBalance: activeCases.reduce((sum, c) => sum + (c.sale_price_mxn || 0) - (c.total_paid_mxn || 0), 0),
      totalOverdue: activeCases.reduce((sum, c) => sum + (c.overdue_amount_mxn || 0), 0),
      byStatus: {
        pending: filteredCases.filter(c => c.status === 'pending').length,
        active: filteredCases.filter(c => c.status === 'active').length,
        executed: filteredCases.filter(c => c.status === 'executed').length,
        cancelled: filteredCases.filter(c => c.status === 'cancelled').length,
      },
    };
  }, [filteredCases]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Case ID', 'Buyer', 'Manzana', 'Lot', 'Plan', 'Sale Price', 'Total Paid', 'Balance', 'Status'];
    const rows = filteredCases.map(c => [
      c.case_id,
      c.buyer_name || '',
      c.manzana || '',
      c.lot || '',
      c.plan_name || '',
      c.sale_price_mxn.toString(),
      c.total_paid_mxn.toString(),
      (c.sale_price_mxn - c.total_paid_mxn).toString(),
      c.status,
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mana88-finance-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        Error loading data: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance Report</h1>
          <p className="text-gray-500 mt-1">Sales pipeline financial overview</p>
        </div>
        <button
          onClick={exportToCSV}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CaseStatus | '')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="contract_generated">Contract Generated</option>
            <option value="executed">Executed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={manzanaFilter}
            onChange={(e) => setManzanaFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">All Manzanas</option>
            {manzanas.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {(statusFilter || manzanaFilter) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setManzanaFilter('');
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Sales Value"
          value={formatMXNCompact(stats.totalSaleValue)}
          subValue={`${stats.totalCases} cases`}
          color="gray"
        />
        <StatCard
          label="Total Collected"
          value={formatMXNCompact(stats.totalCollected)}
          subValue={`${Math.round((stats.totalCollected / stats.totalSaleValue) * 100 || 0)}% of total`}
          color="green"
        />
        <StatCard
          label="Outstanding Balance"
          value={formatMXNCompact(stats.totalBalance)}
          color="blue"
        />
        <StatCard
          label="Overdue Amount"
          value={formatMXNCompact(stats.totalOverdue)}
          color={stats.totalOverdue > 0 ? 'red' : 'gray'}
        />
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-yellow-50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-yellow-700">Pending</span>
            <span className="text-2xl font-bold text-yellow-700">{stats.byStatus.pending}</span>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700">Active</span>
            <span className="text-2xl font-bold text-blue-700">{stats.byStatus.active}</span>
          </div>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-700">Executed</span>
            <span className="text-2xl font-bold text-green-700">{stats.byStatus.executed}</span>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Cancelled</span>
            <span className="text-2xl font-bold text-gray-600">{stats.byStatus.cancelled}</span>
          </div>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">All Cases ({filteredCases.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Case ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buyer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sale Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCases.map(c => {
                const balance = c.sale_price_mxn - c.total_paid_mxn;
                const progress = c.sale_price_mxn > 0 ? Math.round((c.total_paid_mxn / c.sale_price_mxn) * 100) : 0;
                
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link 
                        to={`/cases/${c.id}`}
                        className="font-mono text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        {c.case_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{c.buyer_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.manzana}-{c.lot}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.plan_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {formatMXN(c.sale_price_mxn)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-medium text-emerald-600">{formatMXN(c.total_paid_mxn)}</div>
                      <div className="text-xs text-gray-400">{progress}%</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={balance > 0 ? 'text-gray-900' : 'text-green-600 font-medium'}>
                        {formatMXN(balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-sm text-gray-700">Totals</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatMXN(stats.totalSaleValue)}</td>
                <td className="px-4 py-3 text-sm text-emerald-600 text-right">{formatMXN(stats.totalCollected)}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatMXN(stats.totalBalance)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
