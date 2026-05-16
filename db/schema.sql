-- Cupbop Park City — Supabase schema
-- Run this in your Supabase project: SQL Editor → New query → paste → Run.

create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  customer_name        text not null,
  customer_phone       text not null,
  customer_email       text not null,
  order_type           text not null check (order_type in ('Pickup','Catering')),
  pickup_date          date not null,
  pickup_time          time not null,
  delivery_address     text,  -- required when order_type = 'Catering'
  payment_method       text not null check (payment_method in ('Cash','Credit Card')),
  special_instructions text,
  status               text not null default 'New' check (status in ('New','Confirmed','Ready','Completed','Cancelled')),
  subtotal             numeric(10,2) not null,
  items                jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists orders_pickup_date_idx on public.orders (pickup_date);
create index if not exists orders_status_idx      on public.orders (status);
create index if not exists orders_created_at_idx  on public.orders (created_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Row Level Security: lock the table down.
-- Customers submit orders via the API route using the SERVICE ROLE key
-- (which bypasses RLS). The browser anon key cannot read or write.
alter table public.orders enable row level security;

-- (Admins will use a separate authenticated client later — leave no policies for now.)
