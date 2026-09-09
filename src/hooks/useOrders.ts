import { useState } from 'react';
import { supabase } from '../supabase/config';
import { getSupabaseErrorMessage } from '../supabase/errors';
import { rowToOrder, orderToRow, type OrderRow } from '../supabase/mappers';
import { Order } from '../types';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Live-subscribes an admin view to the orders table. Returns an unsubscribe function. */
  const subscribeToOrders = (onData: (data: Order[]) => void, onError: (err: Error) => void) => {
    let active = true;

    async function fetchOrders() {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (!active) return;

      if (fetchError) {
        onError(new Error(getSupabaseErrorMessage(fetchError, 'Failed to load orders.')));
        return;
      }

      onData(((data ?? []) as OrderRow[]).map(rowToOrder));
    }

    fetchOrders();

    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  };

  const addOrder = async (orderData: Omit<Order, 'id' | 'createdAt' | 'status'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('orders')
        .insert(orderToRow(orderData))
        .select('id')
        .single();
      if (insertError) throw insertError;
      return data!.id as string;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to place order.'));
    }
  };

  /**
   * Checks whether this phone number has ordered before (used to gate the
   * first-order discount at checkout). Calls a SECURITY DEFINER Postgres
   * function instead of selecting the orders table directly, so anonymous
   * shoppers can check this without being able to read anyone else's order
   * data — full order rows stay admin-only (see supabase/schema.sql).
   */
  const getOrdersByPhone = async (phone: string): Promise<Order[]> => {
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    if (!normalizedPhone) return [];

    try {
      const { data, error: rpcError } = await supabase.rpc('phone_has_orders', {
        p_phone: normalizedPhone,
      });
      if (rpcError) throw rpcError;
      // Callers only check `.length === 0`, so a 1-item placeholder is enough.
      return data ? ([{} as Order]) : [];
    } catch (err) {
      console.error('getOrdersByPhone error:', getSupabaseErrorMessage(err, 'Failed to check orders.'));
      return [];
    }
  };

  const updateOrderStatus = async (id: string, status: Order['status']) => {
    try {
      const { error: updateError } = await supabase.from('orders').update({ status }).eq('id', id);
      if (updateError) throw updateError;
    } catch (err) {
      throw new Error(getSupabaseErrorMessage(err, 'Failed to update order status.'));
    }
  };

  return {
    orders,
    loading,
    error,
    addOrder,
    getOrdersByPhone,
    updateOrderStatus,
    subscribeToOrders,
  };
}
