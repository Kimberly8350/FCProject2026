-- ============================================================
-- Fuel City Portal — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────
-- REFERENCE TABLES (seeded from spreadsheets)
-- ──────────────────────────────────────────────

create table if not exists public.sites (
  site_id        integer primary key,
  site_name      text    not null,
  site_address   text,
  city           text,
  state          text,
  zip            text,
  longitude      numeric,
  latitude       numeric,
  auto_diesel    boolean default false,
  truck_diesel   boolean default false,
  bio_tank       boolean default false,
  auto_diesel_note   text,
  truck_diesel_note  text,
  bio_tank_note      text
);

-- All delivery sites (Fuel City + all other customers) used for ETA routing
create table if not exists public.all_sites (
  site_id              integer primary key,
  site_name            text,
  site_address         text,
  city                 text,
  state                text,
  zip                  text,
  longitude            numeric,
  latitude             numeric,
  customer_group_name  text
);

create table if not exists public.terminals (
  terminal_id           text primary key,
  terminal_abbreviation text,
  terminal_name         text not null,
  terminal_address      text,
  city                  text,
  state                 text,
  latitude              numeric,
  longitude             numeric,
  is_fuel_city          boolean default false,
  is_custom             boolean default false  -- user-added via "Add New Terminal"
);

create table if not exists public.suppliers (
  supplier_id             serial primary key,
  supplier_name           text not null,
  supplier_loading_number text not null
);

create table if not exists public.email_notifications (
  email_id  serial primary key,
  name      text    not null,
  email     text    not null unique,
  send      boolean default false,
  receive   boolean default false,
  active    boolean default true
);

-- ──────────────────────────────────────────────
-- LOADS (synced every 15 min from Excel/ODBC)
-- ──────────────────────────────────────────────

create table if not exists public.loads (
  id                  uuid default gen_random_uuid() primary key,
  ce_id               integer not null,
  delivery_date       date    not null,
  customer            text,
  order_number        text,
  site_id             integer,
  site_name           text,
  terminal_id         text,
  terminal_name       text,
  product_name        text    not null,
  gallons_ordered     numeric,
  site_address        text,
  city                text,
  state               text,
  first_name          text,
  last_name           text,
  start_window        timestamptz,
  end_window          timestamptz,
  delivery_eta        timestamptz,
  arrived_at_rack_time timestamptz,
  load_status         integer not null,
  customer_id         integer,
  synced_at           timestamptz default now(),
  unique (ce_id, product_name)
);

create index if not exists loads_delivery_date_idx on public.loads (delivery_date);
create index if not exists loads_site_id_idx       on public.loads (site_id);
create index if not exists loads_ce_id_idx         on public.loads (ce_id);
create index if not exists loads_driver_idx        on public.loads (first_name, last_name, delivery_date);

-- ──────────────────────────────────────────────
-- USER OVERRIDES (persist across syncs)
-- ──────────────────────────────────────────────

-- One row per CE_ID — stores Fuel City user selections
create table if not exists public.load_settings (
  ce_id                integer primary key,
  terminal_id          text references public.terminals (terminal_id),
  supplier_id          integer references public.suppliers (supplier_id),
  supplier_number      text,
  notes                text,
  needs_review         boolean default false,
  needs_review_notes   text,
  updated_at           timestamptz default now()
);

-- ──────────────────────────────────────────────
-- CHANGE HISTORY (14-day immutable audit log)
-- ──────────────────────────────────────────────

create table if not exists public.load_changes (
  id                  uuid default gen_random_uuid() primary key,
  ce_id               integer,              -- null for general notifications
  change_type         text not null,        -- see ChangeRequestType in types/index.ts
  description         text,
  old_value           text,
  new_value           text,
  notes               text,
  dispatch_response   text,
  response_received_at timestamptz,
  created_at          timestamptz default now()
);

create index if not exists load_changes_ce_id_idx     on public.load_changes (ce_id);
create index if not exists load_changes_created_at_idx on public.load_changes (created_at);

-- General notifications (not load-specific)
create table if not exists public.general_notifications (
  id                   uuid default gen_random_uuid() primary key,
  message              text not null,
  dispatch_response    text,
  response_received_at timestamptz,
  created_at           timestamptz default now()
);

-- ──────────────────────────────────────────────
-- PAPERWORK (BOL PDFs)
-- ──────────────────────────────────────────────

create table if not exists public.paperwork (
  id           uuid default gen_random_uuid() primary key,
  ce_id        integer not null,
  file_name    text    not null,
  storage_path text    not null,
  uploaded_at  timestamptz default now(),
  unique (ce_id, file_name)
);

create index if not exists paperwork_ce_id_idx on public.paperwork (ce_id);

-- ──────────────────────────────────────────────
-- EMAIL ROUTING (links inbound email replies to records)
-- ──────────────────────────────────────────────

create table if not exists public.email_threads (
  id               uuid default gen_random_uuid() primary key,
  message_id       text unique,            -- email Message-ID header for threading
  reference_type   text not null,          -- 'load_change' | 'general_notification'
  reference_id     uuid not null,          -- id in load_changes or general_notifications
  created_at       timestamptz default now()
);

-- ──────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────

alter table public.sites                 enable row level security;
alter table public.all_sites             enable row level security;
alter table public.terminals             enable row level security;
alter table public.suppliers             enable row level security;
alter table public.email_notifications   enable row level security;
alter table public.loads                 enable row level security;
alter table public.load_settings         enable row level security;
alter table public.load_changes          enable row level security;
alter table public.general_notifications enable row level security;
alter table public.paperwork             enable row level security;
alter table public.email_threads         enable row level security;

-- All authenticated users can read reference data
create policy "Authenticated read sites"
  on public.sites for select to authenticated using (true);

create policy "Authenticated read all_sites"
  on public.all_sites for select to authenticated using (true);

create policy "Authenticated read terminals"
  on public.terminals for select to authenticated using (true);

create policy "Authenticated read suppliers"
  on public.suppliers for select to authenticated using (true);

-- Only fuel_city role can write to terminals (add custom) and suppliers
create policy "Authenticated read loads"
  on public.loads for select to authenticated using (true);

create policy "Authenticated read load_settings"
  on public.load_settings for select to authenticated using (true);

create policy "Authenticated write load_settings"
  on public.load_settings for all to authenticated using (true);

create policy "Authenticated read load_changes"
  on public.load_changes for select to authenticated using (true);

create policy "Fuel city write load_changes"
  on public.load_changes for insert to authenticated with check (true);

create policy "Authenticated read general_notifications"
  on public.general_notifications for select to authenticated using (true);

create policy "Fuel city write general_notifications"
  on public.general_notifications for insert to authenticated with check (true);

create policy "Authenticated read paperwork"
  on public.paperwork for select to authenticated using (true);

create policy "Authenticated read email_notifications"
  on public.email_notifications for select to authenticated using (true);

create policy "Fuel city write email_notifications"
  on public.email_notifications for all to authenticated using (true);

create policy "Authenticated read email_threads"
  on public.email_threads for select to authenticated using (true);

-- Service role bypasses RLS for sync worker and inbound email webhook
-- (service role key is used server-side only, never in the browser)

-- ──────────────────────────────────────────────
-- AUTO-PURGE: delete load_changes older than 14 days
-- Enable pg_cron extension in Supabase dashboard first,
-- then uncomment the lines below.
-- ──────────────────────────────────────────────

-- select cron.schedule(
--   'purge-old-load-changes',
--   '0 3 * * *',  -- 3am daily
--   $$delete from public.load_changes where created_at < now() - interval '14 days'$$
-- );

-- select cron.schedule(
--   'purge-old-general-notifications',
--   '0 3 * * *',
--   $$delete from public.general_notifications where created_at < now() - interval '14 days'$$
-- );
