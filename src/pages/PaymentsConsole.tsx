// Payments Console - Record and manage payments
import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCases, useCase } from '../hooks/useCases';
import { usePaymentsByCase, usePaymentSchedule, useRecordPayment, calculatePaymentTotals } from '../hooks/usePayments';
import { formatMXN, formatDate, PAYMENT_TYPE_LABELS, SCHEDULE_STATUS_LABELS, PAYMENT_STATUS_COLORS, STATUS_COLORS, STATUS_LABELS } from '../lib/utils';
import type { PaymentType, CaseSummary } from '../types';

// Case Selector Card
function CaseSelectorCard({ 
  caseData, 
  selected, 
  onClick 
}: { 
  caseData: CaseSummary; 
  selected: boolean; 
  onClick: () => void;
}) {
  const progress = caseData.sale_price_mxn > 0 
    ? Math.round((caseData.total_paid_mxn / caseData.sale_price_mxn) * 100) 
    : 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
        selected 
          ? 'border-emerald-500 bg-emerald-50' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm font-medium text-emerald-600">{caseData.case_id}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[caseData.status]}`}>
          {STATUS_LABELS[caseData.status]}
        </span>
      </div>
      <p className="text-sm text-gray-900 font-medium truncate">{caseData.buyer_name}</p>
      <p className="text-xs text-gray-500">{caseData.manzana}-{caseData.lot}</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-gray-500">{progress}%</span>
      </div>
    </button>
  );
}

// Payment Form
function PaymentForm({ 
  caseId, 
  onSuccess 
}: { 
  caseId: string;
  onSuccess: () => void;
}) {
  const { data: schedule } = usePaymentSchedule(caseId);
  const recordPayment = useRecordPayment();
  
  const [formData, setFormData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amountMxn: '',
    paymentType: 'mensualidad' as PaymentType,
    appliedToInstallment: '',
    channel: '',
    referenceNumber: '',
    notes: '',
  });

  // Find next unpaid schedule item
  const nextUnpaid = useMemo(() => {
    return schedule?.find(s => s.status === 'pending' || s.status === 'partial');
  }, [schedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(formData.amountMxn);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      await recordPayment.mutateAsync({
        case_id: caseId,
        payment_date: formData.paymentDate,
        amount_mxn: amount,
        payment_type: formData.paymentType,
        channel: formData.channel || undefined,
        reference: formData.referenceNumber || undefined,
        notes: formData.notes || undefined,
      });

      // Reset form
      setFormData({
        paymentDate: new Date().toISOString().split('T')[0],
        amountMxn: '',
        paymentType: 'mensualidad',
        appliedToInstallment: '',
        channel: '',
        referenceNumber: '',
        notes: '',
      });
      onSuccess();
    } catch (err) {
      console.error('Failed to record payment:', err);
      alert('Failed to record payment. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
          <input
            type="date"
            value={formData.paymentDate}
            onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (MXN) *</label>
          <input
            type="number"
            step="0.01"
            value={formData.amountMxn}
            onChange={(e) => setFormData(prev => ({ ...prev, amountMxn: e.target.value }))}
            placeholder={nextUnpaid ? String(nextUnpaid.amount_mxn - nextUnpaid.paid_amount_mxn) : '0.00'}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type *</label>
          <select
            value={formData.paymentType}
            onChange={(e) => setFormData(prev => ({ ...prev, paymentType: e.target.value as PaymentType }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {Object.entries(PAYMENT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Apply to Installment</label>
          <select
            value={formData.appliedToInstallment}
            onChange={(e) => setFormData(prev => ({ ...prev, appliedToInstallment: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">Auto-detect</option>
            {schedule?.map((item, idx) => (
              <option key={item.id} value={idx + 1}>
                #{idx + 1} - {item.label || PAYMENT_TYPE_LABELS[item.payment_type]} ({formatMXN(item.amount_mxn)})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
          <select
            value={formData.channel}
            onChange={(e) => setFormData(prev => ({ ...prev, channel: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">Select...</option>
            <option value="wire">Wire Transfer</option>
            <option value="check">Check</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
          <input
            type="text"
            value={formData.referenceNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, referenceNumber: e.target.value }))}
            placeholder="Bank reference..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Proof</label>
        <input
          type="file"
          accept="image/*,.pdf"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={2}
          placeholder="Any additional notes..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      <button
        type="submit"
        disabled={recordPayment.isPending}
        className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {recordPayment.isPending ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            Recording...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Record Payment
          </>
        )}
      </button>
    </form>
  );
}

export function PaymentsConsole() {
  const { caseId: urlCaseId } = useParams<{ caseId?: string }>();
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(urlCaseId || null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: allCases, isLoading: casesLoading } = useCases();
  const { data: selectedCase } = useCase(selectedCaseId || '');
  const { data: payments, refetch: refetchPayments } = usePaymentsByCase(selectedCaseId || '');
  const { data: schedule } = usePaymentSchedule(selectedCaseId || '');

  // Filter cases by search
  const filteredCases = useMemo(() => {
    if (!allCases) return [];
    if (!searchQuery) return allCases.filter(c => c.status !== 'cancelled');
    
    const q = searchQuery.toLowerCase();
    return allCases.filter(c =>
      c.case_id.toLowerCase().includes(q) ||
      c.buyer_name?.toLowerCase().includes(q) ||
      `${c.manzana}-${c.lot}`.toLowerCase().includes(q)
    );
  }, [allCases, searchQuery]);

  const totals = calculatePaymentTotals(payments || []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments Console</h1>
        <p className="text-gray-500 mt-1">Record and manage payments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Case Selection */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-4">Select Case</h2>
            
            {/* Search */}
            <div className="relative mb-4">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              />
            </div>

            {/* Case List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {casesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                </div>
              ) : filteredCases.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No cases found</p>
              ) : (
                filteredCases.map(c => (
                  <CaseSelectorCard
                    key={c.id}
                    caseData={c}
                    selected={selectedCaseId === c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Payment Form & Details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCaseId && selectedCase ? (
            <>
              {/* Case Summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-semibold text-emerald-600">
                        {selectedCase.case_id}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedCase.status]}`}>
                        {STATUS_LABELS[selectedCase.status]}
                      </span>
                    </div>
                    <p className="text-gray-500">{selectedCase.buyer_name} &middot; {selectedCase.manzana}-{selectedCase.lot}</p>
                  </div>
                  <Link
                    to={`/cases/${selectedCaseId}`}
                    className="text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    View Case &rarr;
                  </Link>
                </div>

                {/* Progress */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Sale Price</p>
                    <p className="font-semibold">{formatMXN(selectedCase.sale_price_mxn)}</p>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-gray-500">Total Paid</p>
                    <p className="font-semibold text-emerald-600">{formatMXN(totals.totalPaid)}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Balance</p>
                    <p className="font-semibold">{formatMXN(selectedCase.sale_price_mxn - totals.totalPaid)}</p>
                  </div>
                </div>
              </div>

              {/* Record Payment Form */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Record New Payment</h2>
                <PaymentForm caseId={selectedCaseId} onSuccess={() => refetchPayments()} />
              </div>

              {/* Schedule */}
              {schedule && schedule.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="font-semibold text-gray-900">Payment Schedule</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {schedule.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-500">{idx + 1}</td>
                            <td className="px-4 py-2 text-sm">{item.label || PAYMENT_TYPE_LABELS[item.payment_type]}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{formatDate(item.due_date)}</td>
                            <td className="px-4 py-2 text-sm text-right">{formatMXN(item.amount_mxn)}</td>
                            <td className="px-4 py-2 text-sm text-right font-medium text-emerald-600">
                              {formatMXN(item.paid_amount_mxn)}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[item.status]}`}>
                                {SCHEDULE_STATUS_LABELS[item.status]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent Payments */}
              {payments && payments.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="font-semibold text-gray-900">Recent Payments</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {payments.slice(0, 5).map(payment => (
                      <div key={payment.id} className="px-6 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {PAYMENT_TYPE_LABELS[payment.payment_type]}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(payment.payment_date)}</p>
                        </div>
                        <p className="font-semibold text-emerald-600">{formatMXN(payment.amount_mxn)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Case</h3>
              <p className="text-gray-500">Choose a case from the list to record or view payments</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
