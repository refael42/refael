-- WhatsApp (Meta Cloud API): contractors get their chat with the PM on WhatsApp.
-- wa_last_inbound_at: last message from the person — free text may be sent for 24h after it,
--                     otherwise only an approved template.
-- wa_opt_out:         the person sent "הסר" / STOP.
alter table public.profiles add column if not exists wa_last_inbound_at timestamptz;
alter table public.profiles add column if not exists wa_opt_out boolean not null default false;

-- webhook deliveries already handled (Meta retries) — server only, no policies
create table if not exists public.wa_inbound (
  id          text primary key,
  from_phone  text not null,
  created_at  timestamptz not null default now()
);
alter table public.wa_inbound enable row level security;

select 'whatsapp ok';
