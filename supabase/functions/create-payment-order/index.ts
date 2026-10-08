import {
  createAdminClient,
  corsHeaders,
  getRazorpayCredentials,
  isPreflight,
  jsonResponse,
} from '../_shared/payment.ts';

interface RequestItem {
  productId: string;
  color: string;
  qty: number;
}

interface CreateOrderRequest {
  checkoutType: 'cart' | 'buyNow';
  customer: {
    name: string;
    phone: string;
    address: string;
    pincode: string;
    notes?: string;
  };
  items: RequestItem[];
}

Deno.serve(async (request) => {
  if (isPreflight(request)) return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const input = await request.json() as CreateOrderRequest;
    const customer = input?.customer;
    const items = input?.items;
    if (
      !customer ||
      typeof customer.name !== 'string' ||
      customer.name.trim().length < 1 ||
      customer.name.length > 120 ||
      typeof customer.phone !== 'string' ||
      customer.phone.replace(/\D/g, '').length < 10 ||
      typeof customer.address !== 'string' ||
      customer.address.trim().length < 1 ||
      customer.address.length > 1000 ||
      typeof customer.pincode !== 'string' ||
      customer.pincode.trim().length < 1 ||
      customer.pincode.length > 20 ||
      (customer.notes !== undefined && (typeof customer.notes !== 'string' || customer.notes.length > 1000)) ||
      !Array.isArray(items) ||
      items.length < 1 ||
      items.length > 50 ||
      (input.checkoutType !== 'cart' && input.checkoutType !== 'buyNow')
    ) {
      return jsonResponse({ error: 'Checkout details are invalid.' }, 400);
    }

    const normalizedItems = items.map((item) => ({
      productId: typeof item?.productId === 'string' ? item.productId.trim() : '',
      color: typeof item?.color === 'string' ? item.color.trim().slice(0, 80) : 'Standard',
      qty: Number(item?.qty),
    }));
    if (normalizedItems.some((item) => !item.productId || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20)) {
      return jsonResponse({ error: 'One or more cart items are invalid.' }, 400);
    }

    if (input.checkoutType === 'buyNow' && normalizedItems.length !== 1) {
      return jsonResponse({ error: 'Buy Now accepts one product at a time.' }, 400);
    }

    const admin = createAdminClient();
    const uniqueProductIds = [...new Set(normalizedItems.map((item) => item.productId))];
    const { data: products, error: productsError } = await admin
      .from('products')
      .select('id, name, sale_price, images, in_stock, is_deleted')
      .in('id', uniqueProductIds);
    if (productsError) throw new Error('Unable to validate product prices.');

    const productById = new Map((products ?? []).map((product) => [product.id, product]));
    if (uniqueProductIds.some((id) => !productById.has(id))) {
      return jsonResponse({ error: 'A product in your cart is no longer available.' }, 400);
    }

    let subtotalPaise = 0;
    const orderItems = normalizedItems.map((item) => {
      const product = productById.get(item.productId)!;
      if (!product.in_stock || product.is_deleted) {
        throw new Error(`${product.name} is currently unavailable.`);
      }
      const pricePaise = Math.round(Number(product.sale_price) * 100);
      if (!Number.isSafeInteger(pricePaise) || pricePaise < 1) {
        throw new Error(`${product.name} has an invalid price.`);
      }
      subtotalPaise += pricePaise * item.qty;
      return {
        productId: product.id,
        productName: product.name,
        color: item.color || 'Standard',
        image: product.images?.[0] ?? '',
        qty: item.qty,
        price: pricePaise / 100,
      };
    });

    if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise < 1) {
      return jsonResponse({ error: 'The order total is invalid.' }, 400);
    }

    let discountPaise = 0;
    let discountPercent = 0;
    let shippingPaise = 0;
    if (input.checkoutType === 'cart') {
      const [{ data: settings, error: settingsError }, { count: priorOrderCount, error: priorOrderError }] = await Promise.all([
        admin.from('settings').select('free_shipping_threshold, first_order_discount').eq('id', 'main').maybeSingle(),
        admin
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('phone', customer.phone.replace(/\D/g, ''))
          .limit(1),
      ]);
      if (settingsError || priorOrderError) throw new Error('Unable to calculate checkout totals.');

      const thresholdPaise = Math.round(Number(settings?.free_shipping_threshold ?? 5000) * 100);
      const firstOrderDiscount = settings?.first_order_discount ?? { enabled: true, percent: 10 };
      const percent = Number(firstOrderDiscount.percent ?? 10);
      if (firstOrderDiscount.enabled !== false && !priorOrderCount && Number.isFinite(percent) && percent > 0 && percent <= 100) {
        discountPercent = percent;
        discountPaise = Math.round((subtotalPaise / 100) * percent) * 100;
      }
      if (subtotalPaise < thresholdPaise) shippingPaise = 20000;
    }

    const totalPaise = subtotalPaise - discountPaise + shippingPaise;
    if (!Number.isSafeInteger(totalPaise) || totalPaise < 100) {
      return jsonResponse({ error: 'The order total is below the minimum payment amount.' }, 400);
    }

    const { keyId, keySecret } = getRazorpayCredentials();
    const orderId = crypto.randomUUID();
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: totalPaise,
        currency: 'INR',
        receipt: orderId,
        notes: { kalarang_order_id: orderId },
      }),
    });
    const razorpayOrder = await razorpayResponse.json();
    if (!razorpayResponse.ok || !razorpayOrder.id) {
      console.error('Razorpay order creation failed:', razorpayOrder?.error?.description ?? razorpayResponse.status);
      return jsonResponse({ error: 'Razorpay could not create the payment order. Please try again.' }, 502);
    }

    const { error: insertError } = await admin.from('orders').insert({
      id: orderId,
      customer_name: customer.name.trim(),
      phone: customer.phone.replace(/\D/g, ''),
      address: customer.address.trim(),
      pincode: customer.pincode.trim(),
      notes: customer.notes?.trim() ?? null,
      items: orderItems,
      subtotal: subtotalPaise / 100,
      discount_amount: discountPaise / 100,
      discount_percent: discountPercent || null,
      shipping_charges: shippingPaise / 100,
      total: totalPaise / 100,
      status: 'pending',
      payment_method: 'online',
      payment_status: 'pending',
      payment_id: null,
      razorpay_order_id: razorpayOrder.id,
    });
    if (insertError) {
      console.error('Order persistence failed:', insertError.message);
      return jsonResponse({ error: 'Your payment order could not be saved. Please try again.' }, 500);
    }

    return jsonResponse({
      orderId,
      razorpayOrderId: razorpayOrder.id,
      keyId,
      amount: totalPaise,
      currency: 'INR',
    });
  } catch (error) {
    console.error('create-payment-order failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to create a payment order.';
    return jsonResponse({ error: message }, 500);
  }
});
