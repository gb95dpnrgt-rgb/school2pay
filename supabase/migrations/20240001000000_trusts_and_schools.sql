-- trusts: the legal entity (multi-academy trust or single school)
create table public.trusts (
  id             uuid primary key default gen_random_uuid(),
  legal_name     text not null,
  stripe_account_id text,
  country        text not null default 'GB',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- schools: one or more schools belonging to a trust
create table public.schools (
  id         uuid primary key default gen_random_uuid(),
  trust_id   uuid not null references public.trusts (id) on delete restrict,
  name       text not null,
  urn        text,                 -- UK Unique Reference Number (optional at creation)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index schools_trust_id_idx on public.schools (trust_id);

-- updated_at trigger (shared function, reused by every table)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trusts_set_updated_at
  before update on public.trusts
  for each row execute function public.set_updated_at();

create trigger schools_set_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.trusts  enable row level security;
alter table public.schools enable row level security;

-- No policies yet: trusts and schools are managed by platform admins using
-- the service-role key (bypasses RLS).  Admin-user-scoped policies are added
-- in the admin_users migration once that table exists.
--
-- Explicitly deny all anon/authenticated access until those policies exist.
create policy "trusts: deny all by default"
  on public.trusts for all
  to anon, authenticated
  using (false);

create policy "schools: deny all by default"
  on public.schools for all
  to anon, authenticated
  using (false);
