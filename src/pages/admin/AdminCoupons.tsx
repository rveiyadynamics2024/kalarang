import React, { useState } from 'react';
import { Plus, Trash2, Edit, X, Wand2, Ticket, Loader2 } from 'lucide-react';
import { useCoupons } from '../../hooks/useCoupons';
import { Coupon } from '../../types';

// Characters that are easy to read (no 0/O, 1/I confusion)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let random = '';
  for (let i = 0; i < 6; i += 1) {
    random += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `KALA${random}`;
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

function describe(c: Coupon): string {
  const base = c.discountType === 'percent' ? `${c.discountValue}% off` : `₹${c.discountValue.toLocaleString('en-IN')} off`;
  const cap = c.discountType === 'percent' && c.maxDiscount ? ` (max ₹${c.maxDiscount.toLocaleString('en-IN')})` : '';
  return base + cap;
}

function statusOf(c: Coupon): { label: string; className: string } {
  if (!c.isActive) return { label: 'Disabled', className: 'bg-gray-200 text-gray-600' };
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return { label: 'Expired', className: 'bg-red-100 text-red-700' };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return { label: 'Used up', className: 'bg-orange-100 text-orange-700' };
  return { label: 'Active', className: 'bg-green-100 text-green-800' };
}

export default function AdminCoupons() {
  const { coupons, loading, error, addCoupon, updateCoupon, deleteCoupon } = useCoupons();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const openAddForm = () => {
    setEditingId(null);
    setCode(generateCode());
    setDiscountType('percent');
    setDiscountValue('');
    setMinOrderAmount('');
    setMaxDiscount('');
    setUsageLimit('');
    setExpiresOn('');
    setIsActive(true);
    setIsFormOpen(true);
  };

  const openEditForm = (c: Coupon) => {
    setEditingId(c.id);
    setCode(c.code);
    setDiscountType(c.discountType);
    setDiscountValue(String(c.discountValue));
    setMinOrderAmount(c.minOrderAmount ? String(c.minOrderAmount) : '');
    setMaxDiscount(c.maxDiscount ? String(c.maxDiscount) : '');
    setUsageLimit(c.usageLimit !== null ? String(c.usageLimit) : '');
    setExpiresOn(toDateInput(c.expiresAt));
    setIsActive(c.isActive);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const value = Number(discountValue);
    if (!code.trim()) return alert('Please enter or generate a coupon code.');
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(code.trim())) {
      return alert('Code can only have letters, numbers, - and _ (3 to 30 characters).');
    }
    if (!Number.isFinite(value) || value <= 0) return alert('Please enter a discount value greater than 0.');
    if (discountType === 'percent' && value > 100) return alert('Percent discount cannot be more than 100.');

    setSubmitting(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: value,
        minOrderAmount: Number(minOrderAmount) || 0,
        maxDiscount: discountType === 'percent' && Number(maxDiscount) > 0 ? Number(maxDiscount) : null,
        usageLimit: Number(usageLimit) > 0 ? Math.floor(Number(usageLimit)) : null,
        // Expires at the END of the chosen day, India time
        expiresAt: expiresOn ? new Date(`${expiresOn}T23:59:59+05:30`).toISOString() : null,
        isActive,
      };

      if (editingId) {
        await updateCoupon(editingId, payload);
      } else {
        await addCoupon(payload);
      }
      setIsFormOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save the coupon.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (c: Coupon) => {
    try {
      await updateCoupon(c.id, { isActive: !c.isActive });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update the coupon.');
    }
  };

  const handleDelete = async (c: Coupon) => {
    if (!window.confirm(`Delete coupon ${c.code}? Old orders that used it keep their discount.`)) return;
    try {
      await deleteCoupon(c.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete the coupon.');
    }
  };

  const inputClass =
    'bg-white border border-[#B8860B]/25 rounded px-3.5 py-2.5 text-sm text-[#1C1008] focus:border-[#7A1C2E] focus:outline-none w-full';
  const labelClass = 'text-xs font-bold text-[#1C1008] uppercase tracking-wider';

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1C1008] uppercase tracking-wide">Coupon Codes</h1>
          <p className="text-xs text-gray-500 mt-1">Create discount codes your customers can use at checkout.</p>
        </div>
        {!isFormOpen && (
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 bg-[#7A1C2E] hover:bg-[#1C1008] text-white px-4 py-2.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
          >
            <Plus className="h-4 w-4" /> New Coupon
          </button>
        )}
      </div>

      {error && <p className="text-sm text-[#7A1C2E] bg-red-50 border border-red-200 rounded p-3">{error}</p>}

      {/* Create / Edit form */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#FDF8F2] border-2 border-[#B8860B]/35 rounded-md p-5 shadow-sm flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-[#1C1008] uppercase">
              {editingId ? 'Edit Coupon' : 'Create Coupon'}
            </h2>
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-gray-500 hover:text-red-600 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Coupon Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  disabled={!!editingId}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. DIWALI10"
                  className={`${inputClass} uppercase font-mono ${editingId ? 'opacity-60' : ''}`}
                />
                {!editingId && (
                  <button
                    type="button"
                    onClick={() => setCode(generateCode())}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-[#1C1008] hover:bg-[#B8860B] text-white px-3 rounded text-xs font-bold uppercase cursor-pointer transition-colors"
                    title="Generate a random code"
                  >
                    <Wand2 className="h-4 w-4" /> Generate
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Discount Type</label>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')} className={inputClass}>
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed amount (₹)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>
                {discountType === 'percent' ? 'Discount Percent (1-100)' : 'Discount Amount (₹)'}
              </label>
              <input type="number" min="1" step="any" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className={inputClass} />
            </div>

            {discountType === 'percent' && (
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Maximum Discount ₹ (optional)</label>
                <input type="number" min="0" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="No limit" className={inputClass} />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Minimum Order ₹ (optional)</label>
              <input type="number" min="0" value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} placeholder="No minimum" className={inputClass} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Total Uses Allowed (optional)</label>
              <input type="number" min="1" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Unlimited" className={inputClass} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Valid Until (optional)</label>
              <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputClass} />
            </div>

            <label className="flex items-center gap-2 text-sm text-[#1C1008] cursor-pointer sm:mt-6">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[#7A1C2E]" />
              Coupon is active
            </label>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-5 py-2.5 rounded text-xs font-bold uppercase tracking-wider border border-[#B8860B]/30 text-[#1C1008] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded text-xs font-bold uppercase tracking-wider bg-[#7A1C2E] hover:bg-[#1C1008] disabled:opacity-60 text-white cursor-pointer"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Coupon'}
            </button>
          </div>
        </form>
      )}

      {/* Coupon list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#B8860B]" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[#B8860B]/30 rounded-md text-gray-500 flex flex-col items-center gap-2">
          <Ticket className="h-10 w-10 text-[#B8860B]" />
          <p className="text-sm">No coupons yet. Click “New Coupon” to create your first one.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#B8860B]/15 rounded-md overflow-x-auto shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#E8D5B0]/40 text-[#1C1008] text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Min Order</th>
                <th className="px-4 py-3">Used</th>
                <th className="px-4 py-3">Valid Until</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.map((c) => {
                const status = statusOf(c);
                return (
                  <tr key={c.id} className="hover:bg-[#FDF8F2]">
                    <td className="px-4 py-3 font-mono font-bold text-[#7A1C2E] select-all">{c.code}</td>
                    <td className="px-4 py-3">{describe(c)}</td>
                    <td className="px-4 py-3">{c.minOrderAmount ? `₹${c.minOrderAmount.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-4 py-3">
                      {c.usedCount}
                      {c.usageLimit !== null ? ` / ${c.usageLimit}` : ''}
                    </td>
                    <td className="px-4 py-3">{c.expiresAt ? toDateInput(c.expiresAt) : 'No expiry'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggle(c)}
                          className="text-[11px] font-bold uppercase text-[#1C1008] hover:text-[#B8860B] px-2 py-1 cursor-pointer"
                        >
                          {c.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => openEditForm(c)} className="p-2 text-gray-500 hover:text-[#7A1C2E] cursor-pointer" title="Edit">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(c)} className="p-2 text-gray-400 hover:text-red-600 cursor-pointer" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}