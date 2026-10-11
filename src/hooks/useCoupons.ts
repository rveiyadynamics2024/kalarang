import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase/config';
import { getSupabaseErrorMessage } from '../supabase/errors';
import { Coupon } from '../types';

interface CouponRow {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export type CouponInput = Omit<Coupon, 'id' | 'usedCount' | 'createdAt'>;

function rowToCoupon(row: CouponRow): Coupon {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    minOrderAmount: Number(row.min_order_amount),
    maxDiscount: row.max_discount != null ? Number(row.max_discount) : null,
    usageLimit: row.usage_limit,
    usedCount: row.used_count,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function inputToRow(input: Partial<CouponInput>) {
  const row: Record<string, unknown> = {};
  if (input.code !== undefined) row.code = input.code.trim().toUpperCase();
  if (input.discountType !== undefined) row.discount_type = input.discountType;
  if (input.discountValue !== undefined) row.discount_value = input.discountValue;
  if (input.minOrderAmount !== undefined) row.min_order_amount = input.minOrderAmount;
  if (input.maxDiscount !== undefined) row.max_discount = input.maxDiscount;
  if (input.usageLimit !== undefined) row.usage_limit = input.usageLimit;
  if (input.expiresAt !== undefined) row.expires_at = input.expiresAt;
  if (input.isActive !== undefined) row.is_active = input.isActive;
  return row;
}

export function useCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(getSupabaseErrorMessage(fetchError, 'Failed to load coupons. Did you run the coupons SQL file?'));
    } else {
      setCoupons(((data ?? []) as CouponRow[]).map(rowToCoupon));
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addCoupon = async (input: CouponInput) => {
    const { error: insertError } = await supabase.from('coupons').insert(inputToRow(input));
    if (insertError) throw new Error(getSupabaseErrorMessage(insertError, 'Failed to create coupon.'));
    await refresh();
  };

  const updateCoupon = async (id: string, input: Partial<CouponInput>) => {
    const { error: updateError } = await supabase.from('coupons').update(inputToRow(input)).eq('id', id);
    if (updateError) throw new Error(getSupabaseErrorMessage(updateError, 'Failed to update coupon.'));
    await refresh();
  };

  const deleteCoupon = async (id: string) => {
    const { error: deleteError } = await supabase.from('coupons').delete().eq('id', id);
    if (deleteError) throw new Error(getSupabaseErrorMessage(deleteError, 'Failed to delete coupon.'));
    await refresh();
  };

  return { coupons, loading, error, addCoupon, updateCoupon, deleteCoupon };
}