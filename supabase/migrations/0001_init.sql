-- VIP (ViTrox Interesting Parking) schema.
-- Run this once in the Supabase SQL editor (or via `supabase db push`) after
-- creating the project. Change '@vitrox.com' below if your domain differs.

create extension if not exists "pgcrypto";

create table if not exists violations (
  id uuid primary key default gen_random_uuid(),
  violation_date date not null,
  description text not null default '',
  created_by_email text not null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists violation_images (
  id uuid primary key default gen_random_uuid(),
  violation_id uuid not null references violations(id) on delete cascade,
  image_path text not null,
  thumb_path text not null,
  width int not null,
  height int not null,
  sort_order int not null default 0
);

create table if not exists plate_numbers (
  id uuid primary key default gen_random_uuid(),
  violation_id uuid not null references violations(id) on delete cascade,
  plate_text text not null
);

create index if not exists violations_date_idx on violations (violation_date);
create index if not exists violation_images_violation_idx on violation_images (violation_id);
create index if not exists plate_numbers_violation_idx on plate_numbers (violation_id);

-- One helper so the domain rule lives in a single place.
create or replace function is_allowed_email() returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() ->> 'email') ilike '%@vitrox.com', false);
$$;

alter table violations enable row level security;
alter table violation_images enable row level security;
alter table plate_numbers enable row level security;

-- Read/write is limited to signed-in @vitrox.com accounts. There are
-- intentionally no update/delete policies for the MVP (append-only log) —
-- add them later if editing/deleting becomes a requirement.
create policy "vitrox read violations" on violations
  for select using (is_allowed_email());
create policy "vitrox insert violations" on violations
  for insert with check (is_allowed_email());

create policy "vitrox read violation_images" on violation_images
  for select using (is_allowed_email());
create policy "vitrox insert violation_images" on violation_images
  for insert with check (is_allowed_email());

create policy "vitrox read plate_numbers" on plate_numbers
  for select using (is_allowed_email());
create policy "vitrox insert plate_numbers" on plate_numbers
  for insert with check (is_allowed_email());

-- Image files themselves live in Cloudflare R2 (see src/lib/r2.ts), not
-- Supabase Storage — this migration only owns the Postgres tables above.
-- If you ran an earlier version of this migration that created a
-- 'violation-images' Supabase Storage bucket, it's unused now and safe to
-- delete from the Supabase dashboard (Storage -> violation-images -> Delete)
-- to reclaim quota.
