-- Project intelligence, step 2: events.
-- One message can say several things ("פז סיים מיזוג חוץ מ-17 ו-18", "מחר אני בקומה 3").
-- Each is stored as an event that points back to the exact message and quote, is matched
-- to tasks, and changes nothing until the PM applies it.
create table if not exists public.project_events (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  source_item_id  uuid references public.source_items(id) on delete cascade,
  type            text not null check (type in (
                    'reported_done', 'started', 'inspected_ok', 'defect', 'commitment',
                    'blocker', 'material_missing', 'approval_missing', 'instruction_change',
                    'new_task', 'dependency_hint')),
  summary         text not null,
  quote           text,
  -- what the model read (names as written)
  extracted       jsonb not null default '{}'::jsonb,
  -- what the server matched: task ids, area ids, contractor, trade, date
  resolved        jsonb not null default '{}'::jsonb,
  confidence      real not null default 0.5,
  status          text not null default 'proposed' check (status in ('proposed', 'needs_info', 'applied', 'dismissed')),
  note            text,
  decided_by      uuid references public.profiles(id) on delete set null,
  decided_at      timestamptz,
  occurred_at     timestamptz not null,
  created_at      timestamptz not null default now()
);
create index if not exists project_events_project_status on public.project_events (project_id, status, occurred_at desc);
create index if not exists project_events_item on public.project_events (source_item_id);

alter table public.project_events enable row level security;
create policy project_events_select on public.project_events for select to authenticated using (public.is_project_staff(project_id));

select 'events ok';
