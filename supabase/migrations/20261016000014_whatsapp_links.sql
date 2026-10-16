-- A PM's own WhatsApp Business number, mirrored into SiteFlow (WhatsApp "Coexistence").
-- Only chats with people the PM chose to follow are kept; everything else is dropped on arrival.
create table if not exists public.whatsapp_links (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid not null references public.profiles(id) on delete cascade,
  waba_id              text not null,
  phone_number_id      text not null unique,
  display_phone        text,
  -- business token from Embedded Signup (server only: no client policy below)
  access_token         text,
  status               text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  history_requested_at timestamptz,
  last_message_at      timestamptz,
  created_at           timestamptz not null default now()
);

-- Who the PM talks to on that number. Content is kept only for status 'follow'.
create table if not exists public.whatsapp_link_contacts (
  id            uuid primary key default gen_random_uuid(),
  link_id       uuid not null references public.whatsapp_links(id) on delete cascade,
  wa_id         text not null,
  name          text,
  status        text not null default 'pending' check (status in ('pending', 'follow', 'ignore')),
  -- the project a manually followed chat belongs to (project members are matched by phone)
  project_id    uuid references public.projects(id) on delete set null,
  -- the chats (sources) its messages were saved into
  source_ids    uuid[] not null default '{}',
  message_count integer not null default 0,
  last_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (link_id, wa_id)
);

-- server-side only (service role); the app reads them through its own checks
alter table public.whatsapp_links         enable row level security;
alter table public.whatsapp_link_contacts enable row level security;
