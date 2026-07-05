-- ─────────────────────────────────────────────────────────────────────────────
-- School shop
-- ─────────────────────────────────────────────────────────────────────────────

create table public.shop_items (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  name          text not null,
  description   text,
  price_pence   integer not null,
  stock         integer,                    -- null = unlimited
  active        boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create type public.shop_order_status as enum ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded');

create table public.shop_orders (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  guardian_id           uuid not null references public.guardians(id) on delete cascade,
  student_id            uuid references public.students(id) on delete set null,
  status                public.shop_order_status not null default 'pending',
  total_pence           integer not null,
  stripe_payment_intent text,
  stripe_checkout_session text,
  note                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.shop_order_lines (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.shop_orders(id) on delete cascade,
  item_id       uuid not null references public.shop_items(id) on delete restrict,
  quantity      integer not null default 1,
  unit_price_pence integer not null,   -- snapshot of price at time of order
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
create index shop_items_school_id_idx on public.shop_items(school_id);
create index shop_orders_school_id_idx on public.shop_orders(school_id);
create index shop_orders_guardian_id_idx on public.shop_orders(guardian_id);
create index shop_order_lines_order_id_idx on public.shop_order_lines(order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.shop_items enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_lines enable row level security;

create policy "shop_items_admin_select" on public.shop_items
  for select using (school_id in (select school_id from public.admin_users where auth_user_id = auth.uid()));
create policy "shop_items_admin_insert" on public.shop_items
  for insert with check (school_id in (select school_id from public.admin_users where auth_user_id = auth.uid()));
create policy "shop_items_admin_update" on public.shop_items
  for update using (school_id in (select school_id from public.admin_users where auth_user_id = auth.uid()));

create policy "shop_orders_admin_select" on public.shop_orders
  for select using (school_id in (select school_id from public.admin_users where auth_user_id = auth.uid()));
create policy "shop_orders_admin_update" on public.shop_orders
  for update using (school_id in (select school_id from public.admin_users where auth_user_id = auth.uid()));

create policy "shop_order_lines_admin_select" on public.shop_order_lines
  for select using (
    order_id in (
      select id from public.shop_orders
      where school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
    )
  );
