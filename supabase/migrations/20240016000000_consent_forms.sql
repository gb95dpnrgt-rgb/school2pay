-- ─────────────────────────────────────────────────────────────────────────────
-- Consent forms
-- ─────────────────────────────────────────────────────────────────────────────

create type public.consent_form_type as enum ('routine_blanket', 'one_off');
create type public.consent_field_type as enum ('yes_no', 'text', 'activity_checklist');

-- One consent form per payment request
create table public.consent_forms (
  id                              uuid primary key default gen_random_uuid(),
  payment_request_id              uuid not null references public.payment_requests(id) on delete cascade,
  type                            public.consent_form_type not null default 'one_off',
  requires_consent_before_payment boolean not null default false,
  info_attachment_url             text,
  created_at                      timestamptz not null default now(),
  constraint consent_forms_payment_request_id_unique unique (payment_request_id)
);

-- Field definitions (template fields + custom fields)
create table public.consent_fields (
  id              uuid primary key default gen_random_uuid(),
  consent_form_id uuid not null references public.consent_forms(id) on delete cascade,
  key             text not null,
  label           text not null,
  field_type      public.consent_field_type not null default 'yes_no',
  required        boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- Parent responses — APPEND-ONLY, never delete signed rows
-- GDPR NOTE: responses jsonb may contain medical/dietary data (special category data
-- under GDPR Art. 9). SELECT is school-scoped via RLS. Contractor must ensure:
--   1. DPA updated to cover special category data.
--   2. ROPA entry added.
--   3. Retention policy enforced (see retention job below).
create table public.consent_responses (
  id                   uuid primary key default gen_random_uuid(),
  consent_form_id      uuid not null references public.consent_forms(id) on delete restrict,
  assignment_id        uuid not null references public.assignments(id) on delete restrict,
  guardian_id          uuid not null references public.guardians(id) on delete restrict,
  responses            jsonb not null default '{}',
  guardian_name_signed text not null,
  signed_at            timestamptz not null default now(),
  signed_ip            text,
  -- Withdrawal: sets withdrawn_at, never deletes original row
  withdrawn_at         timestamptz,
  withdrawn_reason     text,
  created_at           timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
create index consent_forms_payment_request_id_idx on public.consent_forms(payment_request_id);
create index consent_fields_consent_form_id_idx on public.consent_fields(consent_form_id);
create index consent_responses_consent_form_id_idx on public.consent_responses(consent_form_id);
create index consent_responses_assignment_id_idx on public.consent_responses(assignment_id);
create index consent_responses_guardian_id_idx on public.consent_responses(guardian_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — school-scoped via payment_request_id → school_id
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.consent_forms enable row level security;
alter table public.consent_fields enable row level security;
alter table public.consent_responses enable row level security;

-- Helper: return the school_id for a given payment_request_id
create or replace function public.consent_form_school_id(p_payment_request_id uuid)
returns uuid language sql security definer stable as $$
  select school_id from public.payment_requests where id = p_payment_request_id;
$$;

-- Helper: return the school_id for a given consent_form_id
create or replace function public.consent_form_school_id_by_form(p_consent_form_id uuid)
returns uuid language sql security definer stable as $$
  select public.consent_form_school_id(payment_request_id)
  from public.consent_forms where id = p_consent_form_id;
$$;

-- consent_forms: admin sees only their school's forms
create policy "consent_forms_admin_select" on public.consent_forms
  for select using (
    public.consent_form_school_id(payment_request_id) in (
      select school_id from public.admin_users where auth_user_id = auth.uid()
    )
  );

create policy "consent_forms_admin_insert" on public.consent_forms
  for insert with check (
    public.consent_form_school_id(payment_request_id) in (
      select school_id from public.admin_users where auth_user_id = auth.uid()
    )
  );

create policy "consent_forms_admin_update" on public.consent_forms
  for update using (
    public.consent_form_school_id(payment_request_id) in (
      select school_id from public.admin_users where auth_user_id = auth.uid()
    )
  );

-- consent_fields: school-scoped via consent_form
create policy "consent_fields_admin_select" on public.consent_fields
  for select using (
    public.consent_form_school_id_by_form(consent_form_id) in (
      select school_id from public.admin_users where auth_user_id = auth.uid()
    )
  );

create policy "consent_fields_admin_insert" on public.consent_fields
  for insert with check (
    public.consent_form_school_id_by_form(consent_form_id) in (
      select school_id from public.admin_users where auth_user_id = auth.uid()
    )
  );

-- consent_responses: special category data — school-scoped SELECT only
-- GDPR: this table contains medical/dietary responses (special category data, Art. 9)
create policy "consent_responses_admin_select" on public.consent_responses
  for select using (
    public.consent_form_school_id_by_form(consent_form_id) in (
      select school_id from public.admin_users where auth_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Retention: purge medical/dietary responses 1 year after trip due_date
-- FLAG FOR REVIEW: 1-year retention period chosen as a reasonable default for
-- school trips. Legal/DPO should confirm. Implement as a Supabase scheduled
-- function or document as a manual step until Edge Functions are enabled.
-- TODO: implement automated purge via Supabase pg_cron or Edge Function.
-- ─────────────────────────────────────────────────────────────────────────────
comment on table public.consent_responses is
  'GDPR special category data (medical/dietary). Retention: purge responses where
   payment_request.due_date < now() - interval ''1 year''. See REVIEW.md.';
