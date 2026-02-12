// Approval Queue Page - Review and approve pending items
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCases } from '../hooks/useCases';
import { formatMXN, formatRelativeTime, STATUS_LABELS, STATUS_COLORS } from '../lib/utils';
import type { CaseSummary } from '../types';

// Approval Card
function ApprovalCard({ 
  caseData, 
  onApprove, 
  onReject 
}: { 
  caseData: CaseSummary; 
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link 
                to={`/cases/${caseData.id}`}
                className="font-mono text-lg font-semibold text-emerald-600 hover:text-emerald-700"
              >
                {caseData.case_id}
              </Link>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[caseData.status]}`}>
                {STATUS_LABELS[caseData.status]}
              </span>
            </div>
            <p className="text-gray-500">{caseData.buyer_name}</p>
          </div>
          <p className="text-xs text-gray-400">{formatRelativeTime(caseData.created_at)}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Property</p>
            <p className="font-medium">{caseData.manzana}-{caseData.lot}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Sale Price</p>
            <p className="font-medium">{formatMXN(caseData.sale_price_mxn)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Plan</p>
            <p className="font-medium">{caseData.plan_name || '—'}</p>
          </div>
        </div>

        {caseData.broker_name && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Broker</p>
            <p className="text-sm font-medium">{caseData.broker_name}</p>
            {caseData.broker_agency && <p className="text-xs text-gray-500">{caseData.broker_agency}</p>}
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
        <Link
          to={`/cases/${caseData.id}`}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          View Details &rarr;
        </Link>
        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="px-4 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

export function ApprovalQueue() {
  const { data: cases, isLoading } = useCases();
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  // Get pending cases
  const pendingCases = cases?.filter(c => c.status === 'pending') || [];
  const recentlyProcessed = cases?.filter(c => 
    c.status !== 'pending' && c.status !== 'cancelled'
  ).slice(0, 5) || [];

  const displayCases = filter === 'pending' ? pendingCases : cases || [];

  const handleApprove = async (caseId: string) => {
    // TODO: Implement approval mutation
    if (window.confirm('Approve this case and mark as Active?')) {
      console.log('Approving case:', caseId);
      // await updateCaseStatus({ caseId, status: 'active' });
    }
  };

  const handleReject = async (caseId: string) => {
    const reason = window.prompt('Rejection reason (optional):');
    if (reason !== null) {
      console.log('Rejecting case:', caseId, 'Reason:', reason);
      // await updateCaseStatus({ caseId, status: 'cancelled', notes: reason });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Queue</h1>
          <p className="text-gray-500 mt-1">
            {pendingCases.length} pending approval{pendingCases.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Pending ({pendingCases.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Cases
          </button>
        </div>
      </div>

      {/* Pending Cases */}
      {pendingCases.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {displayCases.filter(c => c.status === 'pending').map(c => (
            <ApprovalCard
              key={c.id}
              caseData={c}
              onApprove={() => handleApprove(c.id)}
              onReject={() => handleReject(c.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
          <p className="text-gray-500">No cases pending approval</p>
        </div>
      )}

      {/* Recently Processed */}
      {recentlyProcessed.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Recently Processed</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentlyProcessed.map(c => (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm font-medium text-emerald-600">{c.case_id}</span>
                  <span className="text-sm text-gray-500">{c.buyer_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                    {STATUS_LABELS[c.status]}
                  </span>
                  <span className="text-xs text-gray-400">{formatRelativeTime(c.updated_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
