-- ─────────────────────────────────────────────────────────────────────────────
-- Meal pre-ordering
-- ─────────────────────────────────────────────────────────────────────────────

create table public.meal_menus (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  date        date not null,
  options     jsonb not null default '[]',   -- array of {id, name, description}
  cutoff_time time not null default '09:30', -- local time ordering closes
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint meal_menus_school_date_unique unique (school_id, date)
);

create table public.meal_orders (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  menu_id     uuid not null references public.meal_menus(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  option_id   text not null,   -- matches id in meal_menus.options jsonb
  option_name text not null,   -- snapshot of choice name
  date        date not null,
  created_at  timestamptz not null default now(),
  constraint meal_orders_student_date_unique unique (student_id, date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
create index meal_menus_school_date_idx on public.meal_menus(school_id, date);
create index meal_orders_menu_id_idx on public.meal_orders(menu_id);
create index meal_orders_date_idx on public.meal_orders(date);
create index meal_orders_student_id_idx on public.meal_orders(student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.meal_menus enable row level security;
alter table public.meal_orders enable row level security;

create policy "meal_menus_admin_select" on public.meal_menus
  for select using (school_id in (select school_id from public.admin_users where auth_user_id = auth.uid()));
create policy "meal_menus_admin_insert" on public.meal_menus
  for insert with check (school_id in (select school_id from public.admin_users where auth_user_id = auth.uid()));
create policy "meal_menus_admin_update" on public.meal_menus
  for update using (school_id in (select school_id from public.admin_users where auth_user_id = auth.uid()));
create policy "meal_menus_admin_delete" on public.meal_menus
  for delete using (school_id in (select school_id from public.admin_users where auth_user_id = auth.uid()));

create policy "meal_orders_admin_select" on public.meal_orders
  for select using (school_id in (select school_id from public.admin_users where auth_user_id = auth.uid()));
create policy "meal_orders_admin_insert" on public.meal_orders
  for insert with check (school_id in (select school_id from public.admin_users where auth_user_id = auth.uid()));
