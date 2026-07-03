-- Wonde MIS integration fields on schools table
alter table public.schools
  add column if not exists wonde_token      text,
  add column if not exists wonde_school_id  text,
  add column if not exists wonde_last_sync  timestamptz;
