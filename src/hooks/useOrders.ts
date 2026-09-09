import { useState } from 'react';
import { supabase } from '../supabase/config';
import { getSupabaseErrorMessage } from '../supabase/errors';
import { rowToOrder, orderToRow, type OrderRow } from '../supabase/mappers';
import { Order } from '../types';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Live-subscribes an admin view to the orders table. Returns an unsubscribe function.
   *
   * onStatus is optional and reports the realtime connection state
   * ('SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') so the UI can
   * show whether live updates are actually working.
   *
   * As a safety net, this also polls every 15s in the background. If the
   * websocket subscription is misconfigured on the Supabase side (e.g.
   * Realtime not enabled for the `orders` table), the admin panel will still
   * pick up new orders within 15 seconds instead of going silently stale.
   */
  const subscribeToOrders = (
    onData: (data: Order[]) => void,
    onError: (err: Error) => void,
    onStatus?: (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => void
  ) => {
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
      .channel(`orders-changes-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        console.log('[orders] realtime event received, refetching...');
        fetchOrders();
      })
      .subscribe((status) => {
        console.log('[orders] realtime channel status:', status);
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          onStatus?.(status);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(
            '[orders] realtime failed to connect. In Supabase Dashboard, check ' +
            'Database -> Replication -> supabase_realtime -> the "orders" table must be toggled ON.'
          );
        }
      });

    // Fallback polling: keeps the admin panel in sync even if the realtime
    // channel above never connects. Harmless no-op extra fetch if realtime
    // is already working fine.
    const pollInterval = window.setInterval(fetchOrders, 15000);

    return () => {
      active = false;
      window.clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  };

  const addOrder = async (orderData: Omit<Order, 'id' | 'createdAt' | 'status'>) => {
    try {
      const orderId = crypto.randomUUID();
      const { data, error: insertError } = await supabase
        .from('orders')
        .insert({ id: orderId, ...orderToRow(orderData) });
      if (insertError) throw insertError;
      return orderId;
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

  /**
   * Returns a shopper's own full order history (all fields, all past
   * orders) looked up by phone number. Powers the customer-facing
   * "Track My Order" page. Uses the get_orders_by_phone() SECURITY DEFINER
   * function so a shopper can only ever see orders tied to the phone number
   * they typed in — never anyone else's data, and no admin login required.
   */
  const getOrderHistoryByPhone = async (phone: string): Promise<Order[]> => {
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    if (!normalizedPhone) return [];

    const { data, error: rpcError } = await supabase.rpc('get_orders_by_phone', {
      p_phone: normalizedPhone,
    });
    if (rpcError) {
      throw new Error(getSupabaseErrorMessage(rpcError, 'Failed to load your orders.'));
    }
    return ((data ?? []) as OrderRow[]).map(rowToOrder);
  };

  /**
   * Polling-based live view of a shopper's own orders (used by the Track
   * Order page). We can't use Supabase Realtime here because the `orders`
   * table's Row Level Security only allows admins to SELECT rows directly —
   * a shopper's access is intentionally limited to the phone-scoped RPC
   * above, and Realtime always evaluates RLS on the raw table. Polling every
   * 10s is what lets status changes made in /admin (e.g. pending -> shipped)
   * show up on the customer's tracking page without exposing all orders.
   */
  const subscribeToOrdersByPhone = (
    phone: string,
    onData: (data: Order[]) => void,
    onError: (err: Error) => void
  ) => {
    let active = true;

    async function fetchHistory() {
      try {
        const data = await getOrderHistoryByPhone(phone);
        if (active) onData(data);
      } catch (err) {
        if (active) onError(err instanceof Error ? err : new Error('Failed to load your orders.'));
      }
    }

    fetchHistory();
    const pollInterval = window.setInterval(fetchHistory, 10000);

    return () => {
      active = false;
      window.clearInterval(pollInterval);
    };
  };

  return {
    orders,
    loading,
    error,
    addOrder,
    getOrdersByPhone,
    getOrderHistoryByPhone,
    subscribeToOrdersByPhone,
    updateOrderStatus,
    subscribeToOrders,
  };
}