-- Run in Supabase Dashboard > SQL Editor. Keep RLS enabled.
create extension if not exists pgcrypto;
create table if not exists public.admin_users(user_id uuid primary key references auth.users(id) on delete cascade,created_at timestamptz not null default now());
create table if not exists public.products(id uuid primary key default gen_random_uuid(),name text not null check(char_length(name) between 1 and 120),category text not null check(category in ('Personalized gifts','Gift hampers','Soft toys','Watches & accessories','Return gifts')),price numeric(10,2) not null check(price>=0),description text not null default '',image_url text,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.orders(id uuid primary key default gen_random_uuid(),customer_name text not null check(char_length(customer_name) between 1 and 100),customer_phone text not null check(char_length(customer_phone) between 5 and 20),delivery_address text not null check(char_length(delivery_address) between 1 and 500),customer_note text not null default '',items jsonb not null check(jsonb_typeof(items)='array'),total numeric(10,2) not null check(total>=0),status text not null default 'New' check(status in ('New','Confirmed','Preparing','Shipped','Delivered','Cancelled')),created_at timestamptz not null default now());
create or replace function public.is_st_raja_admin() returns boolean language sql security definer set search_path='' stable as $$ select exists(select 1 from public.admin_users au where au.user_id=(select auth.uid())); $$;
revoke all on function public.is_st_raja_admin() from public; grant execute on function public.is_st_raja_admin() to anon,authenticated;
alter table public.admin_users enable row level security;alter table public.products enable row level security;alter table public.orders enable row level security;
drop policy if exists "admin list only" on public.admin_users;create policy "admin list only" on public.admin_users for select to authenticated using(public.is_st_raja_admin());
drop policy if exists "public reads active products" on public.products;create policy "public reads active products" on public.products for select to anon,authenticated using(active=true or public.is_st_raja_admin());
drop policy if exists "admin inserts products" on public.products;create policy "admin inserts products" on public.products for insert to authenticated with check(public.is_st_raja_admin());
drop policy if exists "admin updates products" on public.products;create policy "admin updates products" on public.products for update to authenticated using(public.is_st_raja_admin()) with check(public.is_st_raja_admin());
drop policy if exists "admin deletes products" on public.products;create policy "admin deletes products" on public.products for delete to authenticated using(public.is_st_raja_admin());
drop policy if exists "public submits order request" on public.orders;create policy "public submits order request" on public.orders for insert to anon,authenticated with check(char_length(customer_name) between 1 and 100 and char_length(customer_phone) between 5 and 20 and char_length(delivery_address) between 1 and 500 and total>=0 and jsonb_typeof(items)='array');
drop policy if exists "admin reads orders" on public.orders;create policy "admin reads orders" on public.orders for select to authenticated using(public.is_st_raja_admin());
drop policy if exists "admin updates orders" on public.orders;create policy "admin updates orders" on public.orders for update to authenticated using(public.is_st_raja_admin()) with check(public.is_st_raja_admin());
insert into public.products(name,category,price,description,active) values('Personalised Photo Frame','Personalized gifts',499,'A keepsake for favourite memories',true),('Celebration Gift Hamper','Gift hampers',799,'A thoughtful bundle',true),('Cuddly Teddy Bear','Soft toys',399,'A soft little hug',true),('Classic Everyday Watch','Watches & accessories',999,'Everyday style',true),('Return Gift Set','Return gifts',299,'A thank-you for guests',true) on conflict do nothing;


-- Product photo storage: public can display images; only approved admins can upload/change/delete.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "Public view product images" on storage.objects;
create policy "Public view product images" on storage.objects for select using(bucket_id='product-images');
drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images" on storage.objects for insert to authenticated with check(bucket_id='product-images' and public.is_st_raja_admin());
drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images" on storage.objects for update to authenticated using(bucket_id='product-images' and public.is_st_raja_admin()) with check(bucket_id='product-images' and public.is_st_raja_admin());
drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images" on storage.objects for delete to authenticated using(bucket_id='product-images' and public.is_st_raja_admin());
