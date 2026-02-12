// New Case Page - Create a new offer/case
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useManzanas, useLotsByManzana, useCreateCase } from '../hooks/useCases';
import { formatMXN, parseAmount } from '../lib/utils';
import type { ScheduleItem } from '../types';

// Payment Plan Presets
const PLAN_PRESETS = {
  '30/60/10': { downPct: 30, monthlyCount: 36, monthlyPct: 60, finalPct: 10 },
  '40/50/10': { downPct: 40, monthlyCount: 30, monthlyPct: 50, finalPct: 10 },
  '50/40/10': { downPct: 50, monthlyCount: 24, monthlyPct: 40, finalPct: 10 },
  '90/10': { downPct: 90, monthlyCount: 0, monthlyPct: 0, finalPct: 10 },
  'custom': null,
};

type PlanKey = keyof typeof PLAN_PRESETS;

export function CaseNew() {
  const navigate = useNavigate();
  const { data: manzanas } = useManzanas();
  const createCase = useCreateCase();

  // Form state
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Property
    manzana: '',
    lot: '',
    // Buyer
    buyer1Name: '',
    buyer2Name: '',
    email1: '',
    email2: '',
    phone1: '',
    phone2: '',
    // Pricing
    listPrice: 0,
    salePrice: 0,
    // Plan
    planName: '30/60/10' as PlanKey,
    downPaymentPct: 30,
    downPaymentMxn: 0,
    monthlyCount: 36,
    monthlyAmount: 0,
    finalPaymentMxn: 0,
    // Broker
    brokerName: '',
    brokerAgency: '',
    brokerEmail: '',
    brokerPhone: '',
    // Notes
    notes: '',
  });

  const { data: availableLots } = useLotsByManzana(formData.manzana);

  // Update form
  const updateField = <K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Calculate payment amounts when sale price or plan changes
  const recalculate = (salePrice: number, planKey: PlanKey) => {
    const preset = PLAN_PRESETS[planKey];
    if (!preset || salePrice <= 0) return;

    const downMxn = Math.round((salePrice * preset.downPct / 100) * 100) / 100;
    const finalMxn = Math.round((salePrice * preset.finalPct / 100) * 100) / 100;
    const monthlyTotal = salePrice - downMxn - finalMxn;
    const monthlyMxn = preset.monthlyCount > 0 
      ? Math.round((monthlyTotal / preset.monthlyCount) * 100) / 100 
      : 0;

    setFormData(prev => ({
      ...prev,
      downPaymentPct: preset.downPct,
      downPaymentMxn: downMxn,
      monthlyCount: preset.monthlyCount,
      monthlyAmount: monthlyMxn,
      finalPaymentMxn: finalMxn,
    }));
  };

  // Handle plan change
  const handlePlanChange = (planKey: PlanKey) => {
    updateField('planName', planKey);
    recalculate(formData.salePrice, planKey);
  };

  // Handle sale price change
  const handleSalePriceChange = (value: string) => {
    const price = parseAmount(value);
    updateField('salePrice', price);
    recalculate(price, formData.planName);
  };

  // Generate schedule from form data
  const generateSchedule = (): ScheduleItem[] => {
    const schedule: ScheduleItem[] = [];
    const today = new Date();

    // Reserva (placeholder - usually immediate)
    schedule.push({
      type: 'reserva',
      label: 'Reserva',
      amount: 50000, // Standard reservation
      date: today.toISOString().split('T')[0],
    });

    // Enganche
    if (formData.downPaymentMxn > 0) {
      const engancheDate = new Date(today);
      engancheDate.setDate(engancheDate.getDate() + 30);
      schedule.push({
        type: 'enganche',
        label: 'Enganche',
        amount: formData.downPaymentMxn - 50000, // Minus reserva
        date: engancheDate.toISOString().split('T')[0],
      });
    }

    // Monthly payments
    if (formData.monthlyCount > 0 && formData.monthlyAmount > 0) {
      for (let i = 1; i <= formData.monthlyCount; i++) {
        const dueDate = new Date(today);
        dueDate.setMonth(dueDate.getMonth() + i + 1); // Start after enganche
        schedule.push({
          type: 'mensualidad',
          label: `Mensualidad ${i}`,
          amount: formData.monthlyAmount,
          date: dueDate.toISOString().split('T')[0],
          dateCalculated: true,
          dateCalculatedOn: today.toISOString().split('T')[0],
        });
      }
    }

    // Final payment (entrega)
    if (formData.finalPaymentMxn > 0) {
      const deliveryDate = new Date(today);
      deliveryDate.setMonth(deliveryDate.getMonth() + formData.monthlyCount + 3);
      schedule.push({
        type: 'entrega',
        label: 'Entrega (10%)',
        amount: formData.finalPaymentMxn,
        date: deliveryDate.toISOString().split('T')[0],
        dateCalculated: true,
        dateCalculatedOn: today.toISOString().split('T')[0],
      });
    }

    return schedule;
  };

  // Submit form
  const handleSubmit = async () => {
    try {
      const schedule = generateSchedule();
      
      const result = await createCase.mutateAsync({
        manzana: formData.manzana,
        lot: formData.lot,
        buyer_name: formData.buyer1Name,
        buyer_name_2: formData.buyer2Name || undefined,
        buyer_email: formData.email1 || undefined,
        buyer_phone: formData.phone1 || undefined,
        list_price_mxn: formData.listPrice || undefined,
        sale_price_mxn: formData.salePrice,
        plan_name: formData.planName,
        down_payment_pct: formData.downPaymentPct,
        down_payment_mxn: formData.downPaymentMxn,
        broker_name: formData.brokerName || undefined,
        broker_agency: formData.brokerAgency || undefined,
        broker_email: formData.brokerEmail || undefined,
        broker_phone: formData.brokerPhone || undefined,
        schedule,
        notes: formData.notes || undefined,
      });

      navigate(`/cases/${result.id}`);
    } catch (err) {
      console.error('Failed to create case:', err);
      alert('Failed to create case. Please try again.');
    }
  };

  // Validation
  const canProceedStep1 = formData.manzana && formData.lot && formData.buyer1Name && formData.salePrice > 0;
  const canProceedStep2 = formData.downPaymentMxn > 0;
  const canSubmit = canProceedStep1 && canProceedStep2;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/cases" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Case</h1>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s === step ? 'bg-emerald-600 text-white' : s < step ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
            }`}>
              {s < step ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : s}
            </div>
            <span className={`text-sm ${s === step ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
              {s === 1 ? 'Property & Buyer' : s === 2 ? 'Payment Plan' : 'Review'}
            </span>
            {s < 3 && <div className="w-8 h-px bg-gray-200 mx-2" />}
          </div>
        ))}
      </div>

      {/* Step 1: Property & Buyer */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Property & Buyer Information</h2>
          
          {/* Property */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manzana *</label>
              <select
                value={formData.manzana}
                onChange={(e) => {
                  updateField('manzana', e.target.value);
                  updateField('lot', '');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select manzana...</option>
                {manzanas?.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lot *</label>
              <select
                value={formData.lot}
                onChange={(e) => updateField('lot', e.target.value)}
                disabled={!formData.manzana}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100"
              >
                <option value="">Select lot...</option>
                {availableLots?.map(l => (
                  <option key={l.id} value={l.lot}>{l.lot} {l.status !== 'available' && `(${l.status})`}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Buyer 1 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Primary Buyer</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.buyer1Name}
                  onChange={(e) => updateField('buyer1Name', e.target.value)}
                  placeholder="Juan Pérez García"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email1}
                  onChange={(e) => updateField('email1', e.target.value)}
                  placeholder="juan@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone1}
                  onChange={(e) => updateField('phone1', e.target.value)}
                  placeholder="+52 984 123 4567"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Buyer 2 (Optional) */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Secondary Buyer (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  value={formData.buyer2Name}
                  onChange={(e) => updateField('buyer2Name', e.target.value)}
                  placeholder="María López Sánchez"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">List Price (MXN)</label>
              <input
                type="text"
                value={formData.listPrice || ''}
                onChange={(e) => updateField('listPrice', parseAmount(e.target.value))}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price (MXN) *</label>
              <input
                type="text"
                value={formData.salePrice || ''}
                onChange={(e) => handleSalePriceChange(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continue &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Payment Plan */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Payment Plan</h2>

          {/* Plan Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Select Plan</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.keys(PLAN_PRESETS) as PlanKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => handlePlanChange(key)}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    formData.planName === key
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium text-gray-900">{key}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Plan Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Down Payment %</label>
              <input
                type="number"
                value={formData.downPaymentPct}
                onChange={(e) => {
                  const pct = parseFloat(e.target.value) || 0;
                  updateField('downPaymentPct', pct);
                  updateField('downPaymentMxn', Math.round((formData.salePrice * pct / 100) * 100) / 100);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Down Payment (MXN)</label>
              <input
                type="text"
                value={formatMXN(formData.downPaymentMxn)}
                readOnly
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Payments</label>
              <input
                type="number"
                value={formData.monthlyCount}
                onChange={(e) => updateField('monthlyCount', parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Amount</label>
              <input
                type="text"
                value={formatMXN(formData.monthlyAmount)}
                readOnly
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Payment Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Down Payment ({formData.downPaymentPct}%)</span>
                <span className="font-medium">{formatMXN(formData.downPaymentMxn)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Monthly ({formData.monthlyCount} payments)</span>
                <span className="font-medium">{formatMXN(formData.monthlyAmount * formData.monthlyCount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Final Payment (10%)</span>
                <span className="font-medium">{formatMXN(formData.finalPaymentMxn)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="text-gray-900 font-medium">Total</span>
                <span className="text-emerald-600 font-bold">{formatMXN(formData.salePrice)}</span>
              </div>
            </div>
          </div>

          {/* Broker (Optional) */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Broker (Optional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="text"
                  value={formData.brokerName}
                  onChange={(e) => updateField('brokerName', e.target.value)}
                  placeholder="Broker name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.brokerAgency}
                  onChange={(e) => updateField('brokerAgency', e.target.value)}
                  placeholder="Agency"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <input
                  type="email"
                  value={formData.brokerEmail}
                  onChange={(e) => updateField('brokerEmail', e.target.value)}
                  placeholder="broker@agency.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <input
                  type="tel"
                  value={formData.brokerPhone}
                  onChange={(e) => updateField('brokerPhone', e.target.value)}
                  placeholder="+52 984 xxx xxxx"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 text-gray-600 hover:text-gray-900"
            >
              &larr; Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedStep2}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Review &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Review & Submit</h2>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Property</h3>
              <p className="text-lg font-semibold">{formData.manzana}-{formData.lot}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Sale Price</h3>
              <p className="text-lg font-semibold text-emerald-600">{formatMXN(formData.salePrice)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Buyer</h3>
              <p className="font-medium">{formData.buyer1Name}</p>
              {formData.buyer2Name && <p className="text-gray-500">{formData.buyer2Name}</p>}
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Payment Plan</h3>
              <p className="font-medium">{formData.planName}</p>
              <p className="text-sm text-gray-500">
                {formatMXN(formData.downPaymentMxn)} down + {formData.monthlyCount} payments
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              placeholder="Any additional notes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 text-gray-600 hover:text-gray-900"
            >
              &larr; Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || createCase.isPending}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {createCase.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Creating...
                </>
              ) : (
                'Create Case'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
