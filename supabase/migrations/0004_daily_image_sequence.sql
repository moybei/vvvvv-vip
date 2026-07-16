-- Backs the new per-day image naming scheme: folder = YYYYMMDD, filename =
-- a running 2-digit sequence number shared by every violation reported that
-- day (01, 02, 03, ...), so a day's photos live in one tidy R2 folder.
--
-- This table is only ever touched through reserve_daily_image_indexes()
-- below (security definer), never directly by the app, so RLS is enabled
-- with no policies — an atomic "reserve N numbers" via a single UPSERT
-- avoids two concurrent uploads on the same day picking the same number
-- and silently overwriting each other's photo in R2.

create table if not exists daily_image_sequences (
  violation_date date primary key,
  next_index int not null default 1
);

alter table daily_image_sequences enable row level security;

create or replace function reserve_daily_image_indexes(p_date date, p_count int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start int;
begin
  insert into daily_image_sequences (violation_date, next_index)
  values (p_date, 1 + p_count)
  on conflict (violation_date) do update
    set next_index = daily_image_sequences.next_index + p_count
  returning next_index - p_count into v_start;
  return v_start;
end;
$$;

grant execute on function reserve_daily_image_indexes(date, int) to authenticated;
