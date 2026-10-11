import React, { useEffect, useRef, useState } from 'react';
import { Ticket, X } from 'lucide-react';
import { validateCoupon } from '../../supabase/payments';

export interface AppliedCoupon {
  code: string;
  discount: number;
}

interface CouponInputProps {
  /** The amount the coupon is applied on (rupees). */
  amount: number;
  applied: AppliedCoupon | null;
  onChange: (coupon: AppliedCoupon | null) => void;
}

/**
 * Small "Have a coupon code?" box used in the Cart and the Buy Now popup.
 * If the amount changes after a coupon is applied (e.g. customer changes
 * quantity), the coupon is checked again automatically.
 */
export default function CouponInput({ amount, applied, onChange }: CouponInputProps) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const appliedRef = useRef(applied);
  appliedRef.current = applied;

  // Re-check an applied coupon whenever the amount changes.
  useEffect(() => {
    const current = appliedRef.current;
    if (!current) return;
    let cancelled = false;
    validateCoupon(current.code, amount)
      .then((result) => {
        if (cancelled) return;
        if (result.valid && result.code) {
          onChange({ code: result.code, discount: Number(result.discount ?? 0) });
        } else {
          onChange(null);
          setMessage({ text: result.message, ok: false });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setMessage({ text: 'Please enter a coupon code.', ok: false });
      return;
    }
    setChecking(true);
    setMessage(null);
    try {
      const result = await validateCoupon(trimmed, amount);
      if (result.valid && result.code) {
        onChange({ code: result.code, discount: Number(result.discount ?? 0) });
        setCode('');
        setMessage({ text: `Coupon ${result.code} applied!`, ok: true });
      } else {
        setMessage({ text: result.message, ok: false });
      }
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Could not check the coupon.', ok: false });
    } finally {
      setChecking(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setMessage(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-[#1C1008] uppercase tracking-wider flex items-center gap-1.5">
        <Ticket className="h-3.5 w-3.5 text-[#B8860B]" /> Coupon Code
      </label>

      {applied ? (
        <div className="flex items-center justify-between bg-green-50 border border-green-700/30 rounded px-3.5 py-2.5 text-sm">
          <span className="text-green-800 font-semibold">
            {applied.code} <span className="font-normal">— you save ₹{applied.discount.toLocaleString('en-IN')}</span>
          </span>
          <button
            type="button"
            onClick={handleRemove}
            className="text-gray-500 hover:text-red-600 cursor-pointer"
            title="Remove coupon"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter coupon code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              // Enter should apply the coupon, not submit the whole checkout form.
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApply();
              }
            }}
            className="flex-grow min-w-0 bg-white border border-[#B8860B]/25 rounded px-3.5 py-2.5 text-sm text-[#1C1008] uppercase focus:border-[#7A1C2E] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={checking}
            className="bg-[#1C1008] hover:bg-[#7A1C2E] disabled:opacity-60 text-white px-4 rounded text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
          >
            {checking ? 'Checking...' : 'Apply'}
          </button>
        </div>
      )}

      {message && (
        <span className={`text-[11px] ${message.ok ? 'text-green-700' : 'text-[#7A1C2E]'}`}>{message.text}</span>
      )}
    </div>
  );
}