# Razorpay live payments

The storefront uses two Supabase Edge Functions for Razorpay:

- `create-payment-order` recalculates totals from current Supabase product prices,
  creates a Razorpay order, and saves a pending order.
- `verify-payment` verifies the Razorpay signature, confirms the payment
  directly with Razorpay, captures an authorized payment if needed, and marks
  the order paid.

## Configure live credentials

1. In the Razorpay Dashboard, switch to **Live Mode** and copy the live Key ID
   and Key Secret. Do not send these credentials in chat or commit them.
2. In Supabase Dashboard, open **Project Settings → Edge Functions → Secrets**
   and add:
   - `RAZORPAY_KEY_ID` = your `rzp_live_...` key ID
   - `RAZORPAY_KEY_SECRET` = your live key secret
3. Ensure automatic capture is enabled in Razorpay, or let the verification
   function capture authorized payments.
4. Link the Supabase CLI to the project and deploy both functions:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy create-payment-order
   supabase functions deploy verify-payment
   ```

5. Run [`../schema.sql`](../schema.sql) in the Supabase SQL Editor. This adds
   payment fields to `orders` and removes the anonymous direct-insert policy;
   order writes now happen through the Edge Functions.
6. Build and deploy the storefront with `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. The Razorpay Key ID is returned by the Edge
   Function at checkout; neither Razorpay credential belongs in a `VITE_*`
   variable. Never expose `SUPABASE_SERVICE_ROLE_KEY` in the storefront.

Use Razorpay Test Mode credentials to test before switching the Supabase
secrets to Live Mode. Changing Edge Function secrets does not require rebuilding
the storefront.
