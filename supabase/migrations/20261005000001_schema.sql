-- SiteFlow core schema
-- Every table here has a matching row type in src/lib/db/types.ts.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Organizations, people, projects
-- ─────────────────────────────────────────────────────────────
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- A profile is a person known to the system. It may exist before the person
-- ever logs in (e.g. a contractor added by the PM); on first login the auth
-- user is linked by phone / email (see handle_new_auth_user below).
create table public.profiles (
  id               uuid primary key default gen_random_uuid(),
  auth_user_id     uuid unique references auth.users(id) on delete set null,
  organization_id  uuid references public.organizations(id) on delete set null,
  full_name        text not null,
  phone            text,
  email            text,
  created_at       timestamptz not null default now()
);
create index profiles_phone_idx on public.profiles (regexp_replace(phone, '\D', '', 'g'));
create index profiles_email_idx on public.profiles (lower(email));

create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  address          text,
  start_date       date,
  target_date      date,
  created_at       timestamptz not null default now()
);

create table public.project_members (
  project_id  uuid not null references public.projects(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        text not null check (role in ('pm', 'contractor', 'viewer')),
  created_at  timestamptz not null default now(),
  primary key (project_id, profile_id)
);
create index project_members_profile_idx on public.project_members (profile_id);

-- building → floor → apartment → room (plus "common" areas such as roof / stairwell)
create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  parent_id   uuid references public.areas(id) on delete cascade,
  type        text not null check (type in ('building', 'floor', 'apartment', 'room', 'common')),
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index areas_project_idx on public.areas (project_id);
create index areas_parent_idx on public.areas (parent_id);

create table public.trades (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  color       text not null default '#64748b',
  sort_order  integer not null default 0
);

create table public.contractors (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  profile_id       uuid unique references public.profiles(id) on delete set null,
  name             text not null,
  phone            text,
  trade_id         uuid references public.trades(id) on delete set null,
  company          text,
  created_at       timestamptz not null default now()
);
create index contractors_org_idx on public.contractors (organization_id);

-- ─────────────────────────────────────────────────────────────
-- Execution graph
-- ─────────────────────────────────────────────────────────────
create table public.external_blockers (
  id                       uuid primary key default gen_random_uuid(),
  project_id               uuid not null references public.projects(id) on delete cascade,
  title                    text not null,
  owner_name               text,
  owner_phone              text,
  status                   text not null default 'open' check (status in ('open', 'resolved')),
  notes                    text,
  expected_date            date,
  resolved_at              timestamptz,
  created_from_message_id  uuid,
  created_at               timestamptz not null default now()
);
create index external_blockers_project_idx on public.external_blockers (project_id);

create table public.plan_files (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  title          text not null,
  file_url       text not null,
  floor_area_id  uuid references public.areas(id) on delete set null,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table public.plan_pins (
  id            uuid primary key default gen_random_uuid(),
  plan_file_id  uuid not null references public.plan_files(id) on delete cascade,
  page          integer not null default 1,
  x             real not null check (x between 0 and 1),
  y             real not null check (y between 0 and 1),
  area_id       uuid references public.areas(id) on delete set null,
  label         text,
  created_at    timestamptz not null default now()
);
create index plan_pins_file_idx on public.plan_pins (plan_file_id);

create table public.tasks (
  id                       uuid primary key default gen_random_uuid(),
  project_id               uuid not null references public.projects(id) on delete cascade,
  area_id                  uuid references public.areas(id) on delete set null,
  trade_id                 uuid references public.trades(id) on delete set null,
  contractor_id            uuid references public.contractors(id) on delete set null,
  title                    text not null,
  description              text,
  -- Stored lifecycle status. The *effective* state (ready / blocked) is
  -- computed by the dependency engine (src/lib/engine) from the graph.
  status                   text not null default 'planned'
                           check (status in ('planned', 'ready', 'in_progress', 'awaiting_approval', 'done', 'blocked_manual')),
  is_critical              boolean not null default false,
  planned_start            date,
  planned_end              date,
  check_at                 timestamptz,
  started_at               timestamptz,
  completed_at             timestamptz,
  blocked_reason           text,
  created_from_message_id  uuid,
  plan_pin_id              uuid references public.plan_pins(id) on delete set null,
  created_by               uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint tasks_planned_range check (planned_end is null or planned_start is null or planned_end >= planned_start),
  constraint tasks_done_has_completed_at check (status <> 'done' or completed_at is not null)
);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_contractor_idx on public.tasks (contractor_id);
create index tasks_area_idx on public.tasks (area_id);
create index tasks_check_idx on public.tasks (check_at) where status not in ('done', 'awaiting_approval');

-- "to_task" cannot start until "from" is done (+ lag_hours, e.g. plaster drying).
-- The source is either a task or an external blocker — exactly one.
create table public.dependencies (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  from_task_id     uuid references public.tasks(id) on delete cascade,
  from_blocker_id  uuid references public.external_blockers(id) on delete cascade,
  to_task_id       uuid not null references public.tasks(id) on delete cascade,
  type             text not null default 'finish_to_start' check (type in ('finish_to_start', 'finish_plus_lag')),
  lag_hours        numeric not null default 0 check (lag_hours >= 0),
  source           text not null default 'manual' check (source in ('manual', 'template', 'ai', 'learned')),
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint dependencies_one_source check ((from_task_id is null) <> (from_blocker_id is null)),
  constraint dependencies_no_self check (from_task_id is distinct from to_task_id),
  constraint dependencies_lag_type check (type = 'finish_plus_lag' or lag_hours = 0)
);
create unique index dependencies_task_edge_uq on public.dependencies (from_task_id, to_task_id) where from_task_id is not null;
create unique index dependencies_blocker_edge_uq on public.dependencies (from_blocker_id, to_task_id) where from_blocker_id is not null;
create index dependencies_project_idx on public.dependencies (project_id);
create index dependencies_to_idx on public.dependencies (to_task_id);

-- Defense in depth: the app validates with the engine first, but the DB also
-- refuses an edge that would close a cycle.
create or replace function public.prevent_dependency_cycle()
returns trigger
language plpgsql
as $$
begin
  if new.from_task_id is null then
    return new;
  end if;
  if exists (
    with recursive downstream(task_id) as (
      select d.to_task_id from public.dependencies d
       where d.from_task_id = new.to_task_id and d.id is distinct from new.id
      union
      select d.to_task_id from public.dependencies d
        join downstream on d.from_task_id = downstream.task_id
       where d.id is distinct from new.id
    )
    select 1 from downstream where task_id = new.from_task_id
  ) or new.from_task_id = new.to_task_id then
    raise exception 'dependency would create a cycle' using errcode = 'P0001', hint = 'cycle';
  end if;
  return new;
end;
$$;

create trigger dependencies_no_cycle
  before insert or update of from_task_id, to_task_id on public.dependencies
  for each row execute function public.prevent_dependency_cycle();

-- ─────────────────────────────────────────────────────────────
-- Templates / rules (Engine 3)
-- ─────────────────────────────────────────────────────────────
-- organization_id null = built-in rule available to everyone.
create table public.rules (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid references public.organizations(id) on delete cascade,
  name                  text not null,
  predecessor_trade_id  uuid not null references public.trades(id) on delete cascade,
  successor_trade_id    uuid not null references public.trades(id) on delete cascade,
  -- optional: only tasks whose title contains the keyword match (e.g. "בדיקת לחץ")
  predecessor_keyword   text,
  successor_keyword     text,
  scope                 text not null default 'same_area' check (scope in ('same_area', 'same_room')),
  lag_hours             numeric not null default 0 check (lag_hours >= 0),
  active                boolean not null default true,
  source                text not null default 'custom' check (source in ('system', 'custom', 'learned')),
  created_at            timestamptz not null default now()
);

-- Every PM decision on a suggested / manual dependency, so future suggestions
-- in this company follow what the PM actually does.
create table public.rule_feedback (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  rule_id               uuid references public.rules(id) on delete set null,
  predecessor_trade_id  uuid not null references public.trades(id) on delete cascade,
  successor_trade_id    uuid not null references public.trades(id) on delete cascade,
  decision              text not null check (decision in ('accepted', 'rejected', 'added')),
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now()
);
create index rule_feedback_pair_idx on public.rule_feedback (organization_id, predecessor_trade_id, successor_trade_id);

-- ─────────────────────────────────────────────────────────────
-- Chat (Engine 2)
-- ─────────────────────────────────────────────────────────────
create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  type             text not null check (type in ('direct', 'group')),
  title            text,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz
);
create index conversations_project_idx on public.conversations (project_id);

create table public.conversation_participants (
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  last_read_at     timestamptz,
  created_at       timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create index conversation_participants_profile_idx on public.conversation_participants (profile_id);

create table public.messages (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid not null references public.conversations(id) on delete cascade,
  project_id         uuid not null references public.projects(id) on delete cascade,
  sender_profile_id  uuid references public.profiles(id) on delete set null, -- null = system
  kind               text not null default 'text' check (kind in ('text', 'image', 'voice', 'file', 'system')),
  text               text,
  media_url          text,
  reply_to_id        uuid references public.messages(id) on delete set null,
  ai_parsed_json     jsonb,
  ai_status          text not null default 'none' check (ai_status in ('none', 'suggested', 'accepted', 'dismissed')),
  ai_reviewed_by     uuid references public.profiles(id) on delete set null,
  ai_reviewed_at     timestamptz,
  meta               jsonb,
  created_at         timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_project_idx on public.messages (project_id, created_at);
create index messages_suggested_idx on public.messages (project_id) where ai_status = 'suggested';

alter table public.tasks
  add constraint tasks_created_from_message_fk
  foreign key (created_from_message_id) references public.messages(id) on delete set null;
alter table public.external_blockers
  add constraint external_blockers_created_from_message_fk
  foreign key (created_from_message_id) references public.messages(id) on delete set null;

create table public.message_links (
  message_id  uuid not null references public.messages(id) on delete cascade,
  task_id     uuid not null references public.tasks(id) on delete cascade,
  kind        text not null check (kind in ('created', 'completion', 'mention', 'blocker')),
  created_at  timestamptz not null default now(),
  primary key (message_id, task_id)
);
create index message_links_task_idx on public.message_links (task_id);

-- ─────────────────────────────────────────────────────────────
-- Completion reports, reminders, notifications, audit
-- ─────────────────────────────────────────────────────────────
create table public.completion_reports (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks(id) on delete cascade,
  contractor_id   uuid references public.contractors(id) on delete set null,
  submitted_by    uuid references public.profiles(id) on delete set null,
  photo_urls      text[] not null default '{}',
  note            text,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by     uuid references public.profiles(id) on delete set null,
  review_comment  text,
  reviewed_at     timestamptz,
  message_id      uuid references public.messages(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index completion_reports_task_idx on public.completion_reports (task_id);
create index completion_reports_pending_idx on public.completion_reports (status) where status = 'pending';

create table public.reminders (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  task_id            uuid references public.tasks(id) on delete cascade,
  message_id         uuid references public.messages(id) on delete cascade,
  blocker_id         uuid references public.external_blockers(id) on delete cascade,
  kind               text not null check (kind in ('check', 'overdue', 'no_response', 'escalation', 'critical_blocker')),
  due_at             timestamptz not null,
  sent_at            timestamptz,
  status             text not null default 'pending' check (status in ('pending', 'sent', 'resolved', 'dismissed')),
  target_profile_id  uuid references public.profiles(id) on delete set null,
  -- one reminder per (kind, subject, occurrence) — makes the cron tick idempotent
  dedupe_key         text not null unique,
  created_at         timestamptz not null default now()
);
create index reminders_project_idx on public.reminders (project_id, status);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  link        text,
  action      jsonb,
  urgent      boolean not null default false,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create table public.audit_log (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references public.projects(id) on delete cascade,
  entity_type       text not null check (entity_type in ('task', 'dependency', 'blocker', 'report', 'message', 'rule', 'plan')),
  entity_id         uuid not null,
  action            text not null,
  from_value        text,
  to_value          text,
  actor_profile_id  uuid references public.profiles(id) on delete set null,
  source            text not null check (source in ('manual', 'chat', 'ai', 'system')),
  meta              jsonb,
  created_at        timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at);
create index audit_log_project_idx on public.audit_log (project_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Housekeeping triggers
-- ─────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

create or replace function public.bump_conversation_last_message()
returns trigger language plpgsql as $$
begin
  update public.conversations set last_message_at = new.created_at
   where id = new.conversation_id
     and (last_message_at is null or last_message_at < new.created_at);
  return new;
end;
$$;

create trigger messages_bump_conversation after insert on public.messages
  for each row execute function public.bump_conversation_last_message();
