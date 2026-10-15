-- Project intelligence, step 1: raw sources.
-- A source is one conversation brought in from outside the app (a WhatsApp chat export,
-- later Coexistence). Its items are kept exactly as received — they are the evidence
-- every later update points back to.
create table if not exists public.sources (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  kind           text not null check (kind in ('whatsapp_export', 'whatsapp_coexistence', 'manual')),
  title          text not null,
  is_group       boolean not null default false,
  -- export display name → { "profile_id": uuid | null, "ignore": bool }
  speakers       jsonb not null default '{}'::jsonb,
  -- messages before this moment are not brought in
  since          timestamptz,
  last_import_at timestamptz,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create unique index if not exists sources_project_kind_title on public.sources (project_id, kind, title);

create table if not exists public.source_items (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  source_id         uuid not null references public.sources(id) on delete cascade,
  -- stable hash of the message, so re-exporting the same chat adds only what is new
  external_id       text not null,
  sent_at           timestamptz not null,
  author            text,
  author_profile_id uuid references public.profiles(id) on delete set null,
  kind              text not null default 'text' check (kind in ('text', 'image', 'voice', 'file', 'system')),
  text              text,
  media_url         text,
  media_name        text,
  status            text not null default 'new' check (status in ('new', 'processed', 'skipped', 'error')),
  created_at        timestamptz not null default now()
);
create unique index if not exists source_items_dedupe on public.source_items (source_id, external_id);
create index if not exists source_items_project_time on public.source_items (project_id, sent_at desc);

alter table public.sources      enable row level security;
alter table public.source_items enable row level security;
-- staff read; all writes go through the server (service role) after authorization
create policy sources_select on public.sources for select to authenticated using (public.is_project_staff(project_id));
create policy source_items_select on public.source_items for select to authenticated using (public.is_project_staff(project_id));

select 'sources ok';
