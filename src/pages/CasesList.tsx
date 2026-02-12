// Cases List Page - Browse and search all cases
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCases, useManzanas } from '../hooks/useCases';
import { formatMXN, formatMXNCompact, STATUS_LABELS, STATUS_COLORS } from '../lib/utils';
import type { CaseSummary, CaseStatus } from '../types';

// Status Badge
function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// Progress Bar
function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
    </div>
  );
}

// Table Row
function CaseRow({ caseData }: { caseData: CaseSummary }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <Link to={`/cases/${caseData.id}`} className="group">
          <span className="font-mono text-sm font-medium text-emerald-600 group-hover:text-emerald-700">
            {caseData.case_id}
          </span>
        </Link>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900">{caseData.buyer_name || '—'}</div>
        {caseData.buyer_name_2 && (
          <div className="text-xs text-gray-500">{caseData.buyer_name_2}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-900">{caseData.manzana}-{caseData.lot}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="text-sm font-medium text-gray-900">{formatMXN(caseData.sale_price_mxn)}</div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="text-sm text-gray-900">{formatMXN(caseData.total_paid_mxn)}</div>
        <div className="text-xs text-gray-500">of {formatMXNCompact(caseData.sale_price_mxn)}</div>
      </td>
      <td className="px-4 py-3 w-32">
        <ProgressBar paid={caseData.total_paid_mxn} total={caseData.sale_price_mxn} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={caseData.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          to={`/cases/${caseData.id}`}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          View &rarr;
        </Link>
      </td>
    </tr>
  );
}

export function CasesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: cases, isLoading, error } = useCases();
  const { data: manzanas } = useManzanas();

  // Filters from URL
  const search = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status') as CaseStatus | null;
  const manzanaFilter = searchParams.get('manzana') || '';
  const sortBy = searchParams.get('sort') || 'updated';
  const sortDir = searchParams.get('dir') || 'desc';

  // Update filter
  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  // Filter and sort cases
  const filteredCases = useMemo(() => {
    if (!cases) return [];

    let result = [...cases];

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.case_id.toLowerCase().includes(q) ||
        c.buyer_name?.toLowerCase().includes(q) ||
        c.buyer_name_2?.toLowerCase().includes(q) ||
        c.buyer_email?.toLowerCase().includes(q) ||
        `${c.manzana}-${c.lot}`.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter) {
      result = result.filter(c => c.status === statusFilter);
    }

    // Manzana filter
    if (manzanaFilter) {
      result = result.filter(c => c.manzana === manzanaFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'case_id':
          comparison = a.case_id.localeCompare(b.case_id);
          break;
        case 'buyer':
          comparison = (a.buyer_name || '').localeCompare(b.buyer_name || '');
          break;
        case 'price':
          comparison = a.sale_price_mxn - b.sale_price_mxn;
          break;
        case 'paid':
          comparison = a.total_paid_mxn - b.total_paid_mxn;
          break;
        case 'progress':
          const pctA = a.sale_price_mxn > 0 ? a.total_paid_mxn / a.sale_price_mxn : 0;
          const pctB = b.sale_price_mxn > 0 ? b.total_paid_mxn / b.sale_price_mxn : 0;
          comparison = pctA - pctB;
          break;
        case 'updated':
        default:
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [cases, search, statusFilter, manzanaFilter, sortBy, sortDir]);

  // Stats
  const stats = useMemo(() => {
    if (!filteredCases.length) return { total: 0, active: 0, value: 0, collected: 0 };
    return {
      total: filteredCases.length,
      active: filteredCases.filter(c => c.status === 'active').length,
      value: filteredCases.reduce((sum, c) => sum + (c.sale_price_mxn || 0), 0),
      collected: filteredCases.reduce((sum, c) => sum + (c.total_paid_mxn || 0), 0),
    };
  }, [filteredCases]);

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        Error loading cases: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
          <p className="text-gray-500 mt-1">
            {stats.total} cases &middot; {formatMXNCompact(stats.collected)} collected of {formatMXNCompact(stats.value)}
          </p>
        </div>
        <Link
          to="/cases/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Case
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by case ID, buyer, or lot..."
                value={search}
                onChange={(e) => updateFilter('q', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter || ''}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="contract_generated">Contract Generated</option>
            <option value="executed">Executed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Manzana Filter */}
          <select
            value={manzanaFilter}
            onChange={(e) => updateFilter('manzana', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">All Manzanas</option>
            {manzanas?.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Clear Filters */}
          {(search || statusFilter || manzanaFilter) && (
            <button
              onClick={() => setSearchParams({})}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500">
              {search || statusFilter || manzanaFilter ? 'No cases match your filters' : 'No cases yet'}
            </p>
            {!search && !statusFilter && !manzanaFilter && (
              <Link
                to="/cases/new"
                className="inline-flex items-center gap-2 mt-4 text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Create your first case &rarr;
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Case ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Buyer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lot
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sale Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCases.map(c => (
                  <CaseRow key={c.id} caseData={c} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
