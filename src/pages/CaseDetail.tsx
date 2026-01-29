// Case Detail Page - Full case view with tabs
import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCase, useUpdateCaseStatus } from '../hooks/useCases';
import { usePaymentsByCase, usePaymentSchedule, calculatePaymentTotals } from '../hooks/usePayments';
import { formatMXN, formatDate, formatRelativeTime, STATUS_LABELS, STATUS_COLORS, PAYMENT_TYPE_LABELS, SCHEDULE_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '../lib/utils';
import type { CaseStatus, PaymentType, ScheduleStatus } from '../types';

// Status Badge
function StatusBadge({ status, size = 'sm' }: { status: CaseStatus | ScheduleStatus; size?: 'sm' | 'lg' }) {
  const labels = { ...STATUS_LABELS, ...SCHEDULE_STATUS_LABELS };
  const colors = { ...STATUS_COLORS, ...PAYMENT_STATUS_COLORS };
  const sizeClasses = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${colors[status]} ${sizeClasses}`}>
      {labels[status]}
    </span>
  );
}

// Info Card
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// Info Row
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || '—'}</span>
    </div>
  );
}

// Tabs
type TabKey = 'overview' | 'schedule' | 'payments' | 'documents';

export function CaseDetail() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const { data: caseData, isLoading, error } = useCase(caseId!);
  const { data: schedule } = usePaymentSchedule(caseId!);
  const { data: payments } = usePaymentsByCase(caseId!);
  const updateStatus = useUpdateCaseStatus();

  const totals = calculatePaymentTotals(payments || []);

  // Status change handler
  const handleStatusChange = async (newStatus: CaseStatus) => {
    if (!caseId) return;
    if (window.confirm(`Change status to ${STATUS_LABELS[newStatus]}?`)) {
      await updateStatus.mutateAsync({ caseId, status: newStatus });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        {error ? `Error loading case: ${error.message}` : 'Case not found'}
      </div>
    );
  }

  const progress = caseData.sale_price_mxn > 0
    ? Math.round((totals.totalPaid / caseData.sale_price_mxn) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to="/cases" className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{caseData.case_id}</h1>
            <StatusBadge status={caseData.status} size="lg" />
          </div>
          <p className="text-gray-500">
            {caseData.manzana}-{caseData.lot} &middot; {caseData.buyer_name}
            {caseData.buyer_name_2 && ` & ${caseData.buyer_name_2}`}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            to={`/payments/${caseId}`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Record Payment
          </Link>
          <div className="relative">
            <select
              value={caseData.status}
              onChange={(e) => handleStatusChange(e.target.value as CaseStatus)}
              className="appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="contract_generated">Contract Generated</option>
              <option value="executed">Executed</option>
              <option value="on_hold">On Hold</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">Sale Price</p>
            <p className="text-2xl font-bold text-gray-900">{formatMXN(caseData.sale_price_mxn)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Paid</p>
            <p className="text-2xl font-bold text-emerald-600">{formatMXN(totals.totalPaid)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Balance</p>
            <p className="text-2xl font-bold text-gray-900">{formatMXN(caseData.sale_price_mxn - totals.totalPaid)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Progress</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="font-bold text-gray-900">{progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {(['overview', 'schedule', 'payments', 'documents'] as TabKey[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Buyer Info */}
          <InfoCard title="Buyer Information">
            <InfoRow label="Primary Buyer" value={caseData.buyer_name} />
            <InfoRow label="Secondary Buyer" value={caseData.buyer_name_2} />
            <InfoRow label="Email" value={caseData.buyer_email} />
          </InfoCard>

          {/* Property Info */}
          <InfoCard title="Property Details">
            <InfoRow label="Manzana" value={caseData.manzana} />
            <InfoRow label="Lot" value={caseData.lot} />
            <InfoRow label="Surface" value={caseData.surface_m2 ? `${caseData.surface_m2} m²` : null} />
            <InfoRow label="List Price" value={formatMXN(caseData.list_price_mxn)} />
            <InfoRow label="Sale Price" value={formatMXN(caseData.sale_price_mxn)} />
          </InfoCard>

          {/* Payment Plan */}
          <InfoCard title="Payment Plan">
            <InfoRow label="Plan Name" value={caseData.plan_name} />
            <InfoRow label="Down Payment" value={caseData.down_payment_mxn ? formatMXN(caseData.down_payment_mxn) : null} />
            <InfoRow label="Monthly Payments" value={caseData.monthly_payment_count} />
            <InfoRow label="Monthly Amount" value={caseData.monthly_payment_amount ? formatMXN(caseData.monthly_payment_amount) : null} />
            <InfoRow label="Final Payment" value={caseData.final_payment_mxn ? formatMXN(caseData.final_payment_mxn) : null} />
          </InfoCard>

          {/* Broker Info */}
          <InfoCard title="Broker">
            <InfoRow label="Name" value={caseData.broker_name} />
            <InfoRow label="Agency" value={caseData.broker_agency} />
            <InfoRow label="Email" value={caseData.broker_email} />
            <InfoRow label="Phone" value={caseData.broker_phone} />
          </InfoCard>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {schedule?.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{PAYMENT_TYPE_LABELS[item.payment_type]}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.label || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(item.due_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatMXN(item.amount_mxn)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">
                      {formatMXN(item.paid_amount_mxn)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status as ScheduleStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!schedule?.length && (
            <p className="p-6 text-center text-gray-500">No payment schedule defined</p>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments?.map(payment => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(payment.payment_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{PAYMENT_TYPE_LABELS[payment.payment_type]}</td>
                    <td className="px-4 py-3 text-sm font-medium text-emerald-600 text-right">
                      {formatMXN(payment.amount_mxn)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{payment.channel || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{payment.reference_number || '—'}</td>
                    <td className="px-4 py-3">
                      {payment.is_verified ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Yes
                        </span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {payment.mana_proof_url ? (
                        <a
                          href={payment.mana_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!payments?.length && (
            <div className="p-6 text-center">
              <p className="text-gray-500 mb-4">No payments recorded</p>
              <Link
                to={`/payments/${caseId}`}
                className="text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Record first payment &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {caseData.offer_pdf_url && (
              <a
                href={caseData.offer_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Offer Letter</p>
                  <p className="text-sm text-gray-500">PDF Document</p>
                </div>
              </a>
            )}
            {caseData.contract_pdf_url && (
              <a
                href={caseData.contract_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Purchase Contract</p>
                  <p className="text-sm text-gray-500">PDF Document</p>
                </div>
              </a>
            )}
            {caseData.folder_url && (
              <a
                href={caseData.folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Case Folder</p>
                  <p className="text-sm text-gray-500">Google Drive</p>
                </div>
              </a>
            )}
          </div>
          {!caseData.offer_pdf_url && !caseData.contract_pdf_url && !caseData.folder_url && (
            <p className="text-center text-gray-500">No documents attached</p>
          )}
        </div>
      )}
    </div>
  );
}
