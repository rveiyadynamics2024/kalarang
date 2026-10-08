import {
  constantTimeEqual,
  createAdminClient,
  corsHeaders,
  getRazorpayCredentials,
  hmacSha256Hex,
  isPreflight,
  jsonResponse,
} from '../_shared/payment.ts';

interface VerifyPaymentRequest {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

Deno.serve(async (request) => {
  if (isPreflight(request)) return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const input = await request.json() as VerifyPaymentRequest;
    if (
      typeof input?.orderId !== 'string' ||
      typeof input?.razorpayOrderId !== 'string' ||
      typeof input?.razorpayPaymentId !== 'string' ||
      typeof input?.razorpaySignature !== 'string'
    ) {
      return jsonResponse({ error: 'Payment verification details are incomplete.' }, 400);
    }

    const admin = createAdminClient();
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, total, payment_status, payment_id, razorpay_order_id')
      .eq('id', input.orderId)
      .maybeSingle();
    if (orderError) throw new Error('Unable to load the order for verification.');
    if (!order || order.razorpay_order_id !== input.razorpayOrderId) {
      return jsonResponse({ error: 'Payment does not match this order.' }, 400);
    }
    if (order.payment_status === 'paid' && order.payment_id === input.razorpayPaymentId) {
      return jsonResponse({ verified: true });
    }
    if (order.payment_status !== 'pending') {
      return jsonResponse({ error: 'This order is not awaiting payment.' }, 409);
    }

    const { keyId, keySecret } = getRazorpayCredentials();
    const expectedSignature = await hmacSha256Hex(
      `${input.razorpayOrderId}|${input.razorpayPaymentId}`,
      keySecret,
    );
    if (!constantTimeEqual(expectedSignature, input.razorpaySignature)) {
      return jsonResponse({ error: 'Razorpay payment signature is invalid.' }, 400);
    }

    const authorization = `Basic ${btoa(`${keyId}:${keySecret}`)}`;
    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.razorpayPaymentId)}`,
      { headers: { Authorization: authorization } },
    );
    let payment = await paymentResponse.json();
    if (!paymentResponse.ok || payment.order_id !== input.razorpayOrderId) {
      return jsonResponse({ error: 'Razorpay could not confirm this payment.' }, 400);
    }

    const expectedAmount = Math.round(Number(order.total) * 100);
    if (payment.amount !== expectedAmount || payment.currency !== 'INR') {
      return jsonResponse({ error: 'Payment amount does not match the order total.' }, 400);
    }

    if (payment.status === 'authorized') {
      const captureResponse = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.razorpayPaymentId)}/capture`,
        {
          method: 'POST',
          headers: { Authorization: authorization, 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: expectedAmount, currency: 'INR' }),
        },
      );
      payment = await captureResponse.json();
      if (!captureResponse.ok) {
        console.error('Razorpay capture failed:', payment?.error?.description ?? captureResponse.status);
        return jsonResponse({ error: 'Payment was authorized but could not be captured. Please contact support.' }, 502);
      }
    }

    if (payment.status !== 'captured') {
      return jsonResponse({ error: 'Razorpay has not captured this payment.' }, 409);
    }

    const { error: updateError } = await admin
      .from('orders')
      .update({ payment_status: 'paid', payment_id: input.razorpayPaymentId, status: 'confirmed' })
      .eq('id', input.orderId)
      .eq('payment_status', 'pending');
    if (updateError) throw new Error('Payment was captured, but the order could not be updated. Please contact support.');

    return jsonResponse({ verified: true });
  } catch (error) {
    console.error('verify-payment failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to verify payment.';
    return jsonResponse({ error: message }, 500);
  }
});
