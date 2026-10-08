alter table public.orders
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed')),
  add column if not exists razorpay_order_id text;

update public.orders
set payment_status = 'paid'
where payment_method = 'online'
  and payment_id is not null
  and payment_status = 'pending';

drop policy if exists "anyone create orders" on public.orders;
