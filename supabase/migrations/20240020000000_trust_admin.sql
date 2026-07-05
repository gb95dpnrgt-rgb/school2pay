-- ─────────────────────────────────────────────────────────────────────────────
-- Trust-level admin users (MAT dashboard access)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.trust_admin_users (
  id            uuid primary key default gen_random_uuid(),
  trust_id      uuid not null references public.trusts(id) on delete cascade,
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  email         text not null,
  created_at    timestamptz not null default now(),
  constraint trust_admin_users_unique unique (trust_id, auth_user_id)
);

create index trust_admin_users_auth_user_id_idx on public.trust_admin_users(auth_user_id);
create index trust_admin_users_trust_id_idx on public.trust_admin_users(trust_id);

alter table public.trust_admin_users enable row level security;

create policy "trust_admin_users_self_select" on public.trust_admin_users
  for select using (auth_user_id = auth.uid());
