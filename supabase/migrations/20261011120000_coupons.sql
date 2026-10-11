-- =============================================================================
-- KALARANG — Coupon codes
-- Run this ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run again (it uses "if not exists" / "or replace").
-- =============================================================================

-- 1) Coupons table ------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric not null check (discount_value > 0),
  min_order_amount numeric not null default 0,
  max_discount numeric,            -- only used for percent coupons (optional cap)
  usage_limit integer,             -- empty = unlimited uses
  used_count integer not null default 0,
  expires_at timestamptz,          -- empty = never expires
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100)
);

-- 2) Remember which coupon was used on each order ----------------------------
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists coupon_discount numeric not null default 0;

-- 3) Security: ONLY the admin can see / create / edit / delete coupons --------
alter table public.coupons enable row level security;

drop policy if exists "admin read coupons" on public.coupons;
create policy "admin read coupons" on public.coupons for select using (is_admin());
drop policy if exists "admin insert coupons" on public.coupons;
create policy "admin insert coupons" on public.coupons for insert with check (is_admin());
drop policy if exists "admin update coupons" on public.coupons;
create policy "admin update coupons" on public.coupons for update using (is_admin()) with check (is_admin());
drop policy if exists "admin delete coupons" on public.coupons;
create policy "admin delete coupons" on public.coupons for delete using (is_admin());

-- 4) validate_coupon: checks a code and returns the discount in rupees -------
-- Customers call this from the cart. The payment function calls the SAME
-- function again on the server, so nobody can fake a discount.
create or replace function public.validate_coupon(p_code text, p_amount numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.coupons%rowtype;
  d numeric;
begin
  select * into c from public.coupons where code = upper(trim(coalesce(p_code, '')));

  if not found or not c.is_active then
    return jsonb_build_object('valid', false, 'message', 'Invalid coupon code.');
  end if;

  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('valid', false, 'message', 'This coupon has expired.');
  end if;

  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return jsonb_build_object('valid', false, 'message', 'This coupon has reached its usage limit.');
  end if;

  if coalesce(p_amount, 0) < c.min_order_amount then
    return jsonb_build_object(
      'valid', false,
      'message', 'Minimum order of Rs. ' || trim(to_char(c.min_order_amount, 'FM99999999990')) || ' is required for this coupon.'
    );
  end if;

  if c.discount_type = 'percent' then
    d := round(p_amount * c.discount_value / 100);
    if c.max_discount is not null then
      d := least(d, c.max_discount);
    end if;
  else
    d := c.discount_value;
  end if;

  d := greatest(least(d, p_amount), 0);

  return jsonb_build_object(
    'valid', true,
    'code', c.code,
    'discount', d,
    'message', 'Coupon applied!'
  );
end;
$$;

revoke all on function public.validate_coupon(text, numeric) from public;
grant execute on function public.validate_coupon(text, numeric) to anon, authenticated, service_role;

-- 5) increment_coupon_usage: +1 use after a payment succeeds (server only) ---
create or replace function public.increment_coupon_usage(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons set used_count = used_count + 1 where code = upper(trim(p_code));
$$;

revoke all on function public.increment_coupon_usage(text) from public, anon, authenticated;
grant execute on function public.increment_coupon_usage(text) to service_role;