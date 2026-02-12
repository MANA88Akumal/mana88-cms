// Dashboard Page - Overview with Stats and Recent Activity
import { Link } from 'react-router-dom';
import { useCases } from '../hooks/useCases';
import { formatMXN, formatMXNCompact, STATUS_LABELS, STATUS_COLORS } from '../lib/utils';
import type { CaseSummary, CaseStatus } from '../types';

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  subValue,
  icon,
  color = 'emerald',
  href
}: { 
  title: string; 
  value: string | number; 
  subValue?: string;
  icon: React.ReactNode;
  color?: 'emerald' | 'blue' | 'amber' | 'red';
  href?: string;
}) {
  const colorClasses = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  const content = (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subValue && <p className="text-sm text-gray-500 mt-1">{subValue}</p>}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return href ? <Link to={href}>{content}</Link> : content;
}

// Status Badge Component
function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// Recent Case Row
function CaseRow({ caseData }: { caseData: CaseSummary }) {
  const progress = caseData.sale_price_mxn > 0 
    ? Math.round((caseData.total_paid_mxn / caseData.sale_price_mxn) * 100) 
    : 0;

  return (
    <Link
      to={`/cases/${caseData.id}`}
      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-gray-900">{caseData.case_id}</span>
          <StatusBadge status={caseData.status} />
        </div>
        <p className="text-sm text-gray-500 truncate mt-1">
          {caseData.buyer_name} &middot; {caseData.manzana}-{caseData.lot}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-900">{formatMXN(caseData.total_paid_mxn)}</p>
        <p className="text-xs text-gray-500">{progress}% of {formatMXNCompact(caseData.sale_price_mxn)}</p>
      </div>
      <div className="w-20">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

export function Dashboard() {
  const { data: cases, isLoading, error } = useCases();

  // Calculate stats
  const stats = {
    totalCases: cases?.length ?? 0,
    activeCases: cases?.filter(c => c.status === 'active').length ?? 0,
    pendingApproval: cases?.filter(c => c.status === 'pending').length ?? 0,
    totalValue: cases?.reduce((sum, c) => sum + (c.sale_price_mxn || 0), 0) ?? 0,
    totalCollected: cases?.reduce((sum, c) => sum + (c.total_paid_mxn || 0), 0) ?? 0,
    overdueAmount: cases?.reduce((sum, c) => sum + (c.overdue_amount_mxn || 0), 0) ?? 0,
  };

  // Get recent cases (last 5 updated)
  const recentCases = cases
    ?.slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5) ?? [];

  // Get cases needing attention (overdue or pending)
  const needsAttention = cases?.filter(c => 
    c.status === 'pending' || (c.overdue_amount_mxn && c.overdue_amount_mxn > 0)
  ).slice(0, 5) ?? [];

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
        Error loading dashboard: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">MANA88 Sales Pipeline Overview</p>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Cases"
          value={stats.activeCases}
          subValue={`${stats.totalCases} total`}
          color="emerald"
          href="/cases"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          title="Pending Approval"
          value={stats.pendingApproval}
          subValue="Awaiting review"
          color="amber"
          href="/approvals"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Total Collected"
          value={formatMXNCompact(stats.totalCollected)}
          subValue={`of ${formatMXNCompact(stats.totalValue)}`}
          color="blue"
          href="/finance"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Overdue"
          value={formatMXNCompact(stats.overdueAmount)}
          subValue="Needs attention"
          color="red"
          href="/payments"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
            <Link to="/cases" className="text-sm text-emerald-600 hover:text-emerald-700">
              View all &rarr;
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentCases.length > 0 ? (
              recentCases.map(c => <CaseRow key={c.id} caseData={c} />)
            ) : (
              <p className="p-6 text-center text-gray-500">No cases yet</p>
            )}
          </div>
        </div>

        {/* Needs Attention */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Needs Attention</h2>
            <Link to="/approvals" className="text-sm text-emerald-600 hover:text-emerald-700">
              View queue &rarr;
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {needsAttention.length > 0 ? (
              needsAttention.map(c => <CaseRow key={c.id} caseData={c} />)
            ) : (
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-500">All caught up!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/cases/new"
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
          >
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">New Case</span>
          </Link>
          <Link
            to="/payments"
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">Record Payment</span>
          </Link>
          <Link
            to="/finance"
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">Finance Report</span>
          </Link>
          <Link
            to="/intake"
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
          >
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">Manual Intake</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
