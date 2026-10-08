import { supabase } from './config';

export interface PaymentOrderRequest {
  checkoutType: 'cart' | 'buyNow';
  customer: {
    name: string;
    phone: string;
    address: string;
    pincode: string;
    notes?: string;
  };
  items: Array<{
    productId: string;
    color: string;
    qty: number;
  }>;
}

export interface PaymentOrder {
  orderId: string;
  razorpayOrderId: string;
  keyId: string;
  amount: number;
  currency: 'INR';
}

export interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  prefill: { name: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayPaymentResponse) => void;
  modal: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

export async function createPaymentOrder(request: PaymentOrderRequest): Promise<PaymentOrder> {
  const { data, error } = await supabase.functions.invoke<PaymentOrder>('create-payment-order', {
    body: request,
  });
  if (error) throw new Error(error.message || 'Could not start online payment.');
  if (!data?.orderId || !data.razorpayOrderId || !data.keyId || !data.amount) {
    throw new Error('The payment service returned an incomplete order.');
  }
  return data;
}

export async function verifyPayment(
  orderId: string,
  response: RazorpayPaymentResponse
): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ verified: boolean }>('verify-payment', {
    body: {
      orderId,
      razorpayOrderId: response.razorpay_order_id,
      razorpayPaymentId: response.razorpay_payment_id,
      razorpaySignature: response.razorpay_signature,
    },
  });
  if (error) throw new Error(error.message || 'Payment verification failed.');
  if (!data?.verified) throw new Error('Payment could not be verified. Please contact support.');
}

export async function openRazorpayCheckout(
  paymentOrder: PaymentOrder,
  details: { name: string; phone: string; description: string },
  handler: (response: RazorpayPaymentResponse) => void,
  onDismiss: () => void
): Promise<void> {
  if (!window.Razorpay) {
    await new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
      if (existingScript) {
        if (existingScript.dataset.loaded === 'true') {
          resolve();
          return;
        }
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Razorpay failed to load.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.dataset.razorpayCheckout = 'true';
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error('Razorpay failed to load.'));
      document.body.appendChild(script);
    });
  }

  if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable.');

  new window.Razorpay({
    key: paymentOrder.keyId,
    order_id: paymentOrder.razorpayOrderId,
    amount: paymentOrder.amount,
    currency: paymentOrder.currency,
    name: 'KALARANG Silks & Studio',
    description: details.description,
    image: '/kalarang.png',
    prefill: { name: details.name, contact: details.phone },
    theme: { color: '#7A1C2E' },
    handler,
    modal: { ondismiss: onDismiss },
  }).open();
}
