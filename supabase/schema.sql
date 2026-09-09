-- =============================================================================
-- KALARANG — Supabase schema
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste this whole file → Run).
--
-- IMPORTANT: before running, edit the admin email list in `is_admin()` near
-- the bottom of the "helpers" section to match VITE_ADMIN_EMAIL / the emails
-- you actually sign in with.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  cover_image text,
  "order" integer not null default 0,
  is_active boolean not null default true,
  description text
);

-- id = product slug (mirrors the old "doc id is the slug" behaviour, so
-- re-adding a product with the same name reliably collides/updates).
create table if not exists products (
  id text primary key,
  name text not null,
  slug text not null unique,
  collection_id text not null,
  fabric text,
  work text,
  border text,
  texture text,
  occasions text[] not null default '{}',
  colors text[] not null default '{}',
  mrp numeric not null default 0,
  sale_price numeric not null default 0,
  images text[] not null default '{}',
  details text,
  video_url text,
  allow_add_to_cart boolean not null default true,
  is_featured boolean not null default false,
  is_new_arrival boolean not null default false,
  in_stock boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists banners (
  id uuid primary key default gen_random_uuid(),
  image_url text,
  headline text,
  subtext text,
  cta_label text,
  cta_link text,
  is_active boolean not null default true
);

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  video_url text not null,
  title text,
  subtitle text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id text primary key default 'main',
  store_name text not null default 'KALARANG — Silks & Studio',
  whatsapp_number text not null default '',
  email text,
  studio_address text,
  announcement_bar jsonb not null default '{"enabled": true, "text": ""}'::jsonb,
  free_shipping_threshold numeric not null default 0,
  first_order_discount jsonb,
  colors jsonb not null default '[]'::jsonb
);

alter table settings add column if not exists colors jsonb not null default '[]'::jsonb;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  address text not null,
  pincode text,
  notes text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  discount_amount numeric,
  discount_percent numeric,
  shipping_charges numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'shipped', 'delivered')),
  created_at timestamptz not null default now()
);

create index if not exists orders_phone_idx on orders (phone);
create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists products_created_at_idx on products (created_at desc);

-- Enable live order updates for the admin dashboard. The guarded block keeps
-- this migration safe to run when the table is already in the publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- EDIT THIS LIST to match your real admin email(s) — same emails you use to
-- sign in at /admin/login and the same ones in VITE_ADMIN_EMAIL.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') in (
    'admin@kalarang.com',
    'vineshjm@gmail.com'
  );
$$;

-- Lets anonymous shoppers check "have I ordered before?" at checkout without
-- exposing anyone's order rows publicly (used for the first-order discount).
create or replace function phone_has_orders(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from orders where phone = p_phone
  );
$$;

revoke all on function phone_has_orders(text) from public;
grant execute on function phone_has_orders(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table collections enable row level security;
alter table products enable row level security;
alter table banners enable row level security;
alter table videos enable row level security;
alter table settings enable row level security;
alter table orders enable row level security;

-- Collections: public read, admin write
drop policy if exists "public read collections" on collections;
create policy "public read collections" on collections for select using (true);
drop policy if exists "admin insert collections" on collections;
create policy "admin insert collections" on collections for insert with check (is_admin());
drop policy if exists "admin update collections" on collections;
create policy "admin update collections" on collections for update using (is_admin()) with check (is_admin());
drop policy if exists "admin delete collections" on collections;
create policy "admin delete collections" on collections for delete using (is_admin());

-- Products: public read, admin write
drop policy if exists "public read products" on products;
create policy "public read products" on products for select using (true);
drop policy if exists "admin insert products" on products;
create policy "admin insert products" on products for insert with check (is_admin());
drop policy if exists "admin update products" on products;
create policy "admin update products" on products for update using (is_admin()) with check (is_admin());
drop policy if exists "admin delete products" on products;
create policy "admin delete products" on products for delete using (is_admin());

-- Banners: public read, admin write
drop policy if exists "public read banners" on banners;
create policy "public read banners" on banners for select using (true);
drop policy if exists "admin insert banners" on banners;
create policy "admin insert banners" on banners for insert with check (is_admin());
drop policy if exists "admin update banners" on banners;
create policy "admin update banners" on banners for update using (is_admin()) with check (is_admin());
drop policy if exists "admin delete banners" on banners;
create policy "admin delete banners" on banners for delete using (is_admin());

-- Videos: public read, admin write
drop policy if exists "public read videos" on videos;
create policy "public read videos" on videos for select using (true);
drop policy if exists "admin insert videos" on videos;
create policy "admin insert videos" on videos for insert with check (is_admin());
drop policy if exists "admin update videos" on videos;
create policy "admin update videos" on videos for update using (is_admin()) with check (is_admin());
drop policy if exists "admin delete videos" on videos;
create policy "admin delete videos" on videos for delete using (is_admin());

-- Settings: public read, admin write
drop policy if exists "public read settings" on settings;
create policy "public read settings" on settings for select using (true);
drop policy if exists "admin insert settings" on settings;
create policy "admin insert settings" on settings for insert with check (is_admin());
drop policy if exists "admin update settings" on settings;
create policy "admin update settings" on settings for update using (is_admin()) with check (is_admin());

-- Orders: anyone can place an order (checkout), only admin can read/manage them.
-- (First-order-discount lookups go through phone_has_orders() above, not a
-- direct select, so customer order details stay private.)
drop policy if exists "anyone create orders" on orders;
create policy "anyone create orders" on orders for insert with check (true);
drop policy if exists "admin read orders" on orders;
create policy "admin read orders" on orders for select using (is_admin());
drop policy if exists "admin update orders" on orders;
create policy "admin update orders" on orders for update using (is_admin()) with check (is_admin());
drop policy if exists "admin delete orders" on orders;
create policy "admin delete orders" on orders for delete using (is_admin());

-- -----------------------------------------------------------------------------
-- Storage: public "media" bucket for product/collection/banner/video images
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "admin upload media" on storage.objects;
create policy "admin upload media" on storage.objects
  for insert with check (bucket_id = 'media' and is_admin());

drop policy if exists "admin update media" on storage.objects;
create policy "admin update media" on storage.objects
  for update using (bucket_id = 'media' and is_admin())
  with check (bucket_id = 'media' and is_admin());

drop policy if exists "admin delete media" on storage.objects;
create policy "admin delete media" on storage.objects
  for delete using (bucket_id = 'media' and is_admin());

-- -----------------------------------------------------------------------------
-- Seed default settings row
-- -----------------------------------------------------------------------------

insert into settings (id, store_name, whatsapp_number, email, announcement_bar, free_shipping_threshold, first_order_discount)
values (
  'main',
  'KALARANG — Silks & Studio',
  '919108955445',
  'studio@kalarang.com',
  '{"enabled": true, "text": "✨ Every first order 10% off ✨"}'::jsonb,
  5000,
  '{"enabled": true, "percent": 10}'::jsonb
)
on conflict (id) do nothing;
