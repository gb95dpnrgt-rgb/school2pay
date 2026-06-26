-- Add email type (initial notification vs reminder chase) and bounce tracking.
alter table public.email_log
  add column type       text not null default 'initial'
                          check (type in ('initial', 'reminder')),
  add column bounced_at timestamptz;

-- Index for bounce webhook lookups by resend_message_id
create index if not exists email_log_resend_message_id_idx
  on public.email_log(resend_message_id)
  where resend_message_id is not null;

-- Index for 48-hour cooldown check
create index if not exists email_log_guardian_request_sent_idx
  on public.email_log(guardian_id, payment_request_id, sent_at desc);
