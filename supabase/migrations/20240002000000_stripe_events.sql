create table public.stripe_events (
  id               uuid primary key default gen_random_uuid(),
  stripe_event_id  text not null unique,
  type             text not null,
  payload          jsonb not null,
  processed_at     timestamptz not null default now()
);

alter table public.stripe_events enable row level security;

-- Service-role only; no authenticated/anon access needed
create policy "stripe_events: deny all by default"
  on public.stripe_events for all
  to anon, authenticated
  using (false);
