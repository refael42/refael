-- Row-level security, auth → profile linking, realtime publication.
--
-- Model: the Next.js server performs mutations with the service role *after*
-- its own authorization checks (src/lib/services/access.ts). RLS is what keeps
-- any direct client access (anon key + user JWT, e.g. realtime subscriptions)
-- scoped: a contractor can only ever read his own tasks, reports and chats.

-- ─────────────────────────────────────────────────────────────
-- Helper functions (security definer so they can read membership tables
-- without recursing into the policies that call them)
-- ─────────────────────────────────────────────────────────────
create or replace function public.current_profile_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.project_role(p_project uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.project_members
   where project_id = p_project and profile_id = public.current_profile_id()
$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.project_members
                  where project_id = p_project and profile_id = public.current_profile_id())
$$;

-- PM or viewer: may read everything in the project
create or replace function public.is_project_staff(p_project uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.project_role(p_project) in ('pm', 'viewer'), false)
$$;

create or replace function public.is_project_pm(p_project uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.project_role(p_project) = 'pm', false)
$$;

create or replace function public.my_contractor_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select id from public.contractors where profile_id = public.current_profile_id()
$$;

create or replace function public.can_see_task(p_task uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
     where t.id = p_task
       and (public.is_project_staff(t.project_id)
            or (public.is_project_member(t.project_id)
                and t.contractor_id in (select public.my_contractor_ids())))
  )
$$;

create or replace function public.can_see_conversation(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
     where c.id = p_conversation
       and (public.is_project_pm(c.project_id)
            or exists (select 1 from public.conversation_participants cp
                        where cp.conversation_id = c.id
                          and cp.profile_id = public.current_profile_id()))
  )
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.projects p
      join public.project_members m on m.project_id = p.id
     where p.organization_id = p_org and m.profile_id = public.current_profile_id()
  )
$$;

create or replace function public.is_org_pm(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.projects p
      join public.project_members m on m.project_id = p.id
     where p.organization_id = p_org and m.profile_id = public.current_profile_id() and m.role = 'pm'
  )
$$;

-- ─────────────────────────────────────────────────────────────
-- Enable RLS everywhere
-- ─────────────────────────────────────────────────────────────
alter table public.organizations            enable row level security;
alter table public.profiles                 enable row level security;
alter table public.projects                 enable row level security;
alter table public.project_members          enable row level security;
alter table public.areas                    enable row level security;
alter table public.trades                   enable row level security;
alter table public.contractors              enable row level security;
alter table public.external_blockers        enable row level security;
alter table public.plan_files               enable row level security;
alter table public.plan_pins                enable row level security;
alter table public.tasks                    enable row level security;
alter table public.dependencies             enable row level security;
alter table public.rules                    enable row level security;
alter table public.rule_feedback            enable row level security;
alter table public.conversations            enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                 enable row level security;
alter table public.message_links            enable row level security;
alter table public.completion_reports       enable row level security;
alter table public.reminders                enable row level security;
alter table public.notifications            enable row level security;
alter table public.push_subscriptions       enable row level security;
alter table public.audit_log                enable row level security;

-- organizations
create policy org_select on public.organizations for select to authenticated
  using (public.is_org_member(id));

-- profiles: yourself, people you chat with, and (for staff) every project member
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = public.current_profile_id()
    or exists (
      select 1 from public.conversation_participants a
        join public.conversation_participants b on a.conversation_id = b.conversation_id
       where a.profile_id = public.current_profile_id() and b.profile_id = profiles.id
    )
    or exists (
      select 1 from public.project_members mine
        join public.project_members theirs on theirs.project_id = mine.project_id
       where mine.profile_id = public.current_profile_id()
         and theirs.profile_id = profiles.id
         and (mine.role in ('pm', 'viewer') or theirs.role = 'pm')
    )
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = public.current_profile_id()) with check (id = public.current_profile_id());

-- projects
create policy projects_select on public.projects for select to authenticated
  using (public.is_project_member(id));
create policy projects_update on public.projects for update to authenticated
  using (public.is_project_pm(id)) with check (public.is_project_pm(id));

-- project_members: staff see all members, contractors see themselves + PMs
create policy members_select on public.project_members for select to authenticated
  using (
    public.is_project_staff(project_id)
    or profile_id = public.current_profile_id()
    or (role = 'pm' and public.is_project_member(project_id))
  );
create policy members_write on public.project_members for all to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));

-- areas / plans: every member may read (contractors need area names), PM writes
create policy areas_select on public.areas for select to authenticated
  using (public.is_project_member(project_id));
create policy areas_write on public.areas for all to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));

create policy plan_files_select on public.plan_files for select to authenticated
  using (public.is_project_member(project_id));
create policy plan_files_write on public.plan_files for all to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));

create policy plan_pins_select on public.plan_pins for select to authenticated
  using (exists (select 1 from public.plan_files f where f.id = plan_file_id and public.is_project_member(f.project_id)));
create policy plan_pins_write on public.plan_pins for all to authenticated
  using (exists (select 1 from public.plan_files f where f.id = plan_file_id and public.is_project_pm(f.project_id)))
  with check (exists (select 1 from public.plan_files f where f.id = plan_file_id and public.is_project_pm(f.project_id)));

-- trades are a global catalogue
create policy trades_select on public.trades for select to authenticated using (true);

-- contractors: staff of any org project see the org's contractors; a contractor sees himself
create policy contractors_select on public.contractors for select to authenticated
  using (
    profile_id = public.current_profile_id()
    or exists (
      select 1 from public.projects p
        join public.project_members m on m.project_id = p.id
       where p.organization_id = contractors.organization_id
         and m.profile_id = public.current_profile_id()
         and m.role in ('pm', 'viewer')
    )
  );
create policy contractors_write on public.contractors for all to authenticated
  using (public.is_org_pm(organization_id)) with check (public.is_org_pm(organization_id));

-- tasks: staff see all, contractors only their own
create policy tasks_select on public.tasks for select to authenticated
  using (public.can_see_task(id));
create policy tasks_write on public.tasks for all to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));

-- dependencies / blockers: staff only (contractors get "why blocked" via the server, which
-- exposes only the blocking titles, never the full graph)
create policy dependencies_select on public.dependencies for select to authenticated
  using (public.is_project_staff(project_id));
create policy dependencies_write on public.dependencies for all to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));

create policy blockers_select on public.external_blockers for select to authenticated
  using (public.is_project_staff(project_id));
create policy blockers_write on public.external_blockers for all to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));

-- rules: built-ins visible to all; org rules to org members
create policy rules_select on public.rules for select to authenticated
  using (organization_id is null or public.is_org_member(organization_id));
create policy rules_write on public.rules for all to authenticated
  using (organization_id is not null and public.is_org_pm(organization_id))
  with check (organization_id is not null and public.is_org_pm(organization_id));

create policy rule_feedback_select on public.rule_feedback for select to authenticated
  using (public.is_org_pm(organization_id));
create policy rule_feedback_insert on public.rule_feedback for insert to authenticated
  with check (public.is_org_pm(organization_id));

-- chat
create policy conversations_select on public.conversations for select to authenticated
  using (public.can_see_conversation(id));
create policy conversations_write on public.conversations for all to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));

create policy participants_select on public.conversation_participants for select to authenticated
  using (public.can_see_conversation(conversation_id));
create policy participants_update_self on public.conversation_participants for update to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());

create policy messages_select on public.messages for select to authenticated
  using (public.can_see_conversation(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_profile_id = public.current_profile_id()
    and exists (select 1 from public.conversation_participants cp
                 where cp.conversation_id = messages.conversation_id
                   and cp.profile_id = public.current_profile_id())
    and ai_status = 'none' and ai_parsed_json is null
  );

create policy message_links_select on public.message_links for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.can_see_conversation(m.conversation_id)));

-- completion reports
create policy reports_select on public.completion_reports for select to authenticated
  using (
    contractor_id in (select public.my_contractor_ids())
    or exists (select 1 from public.tasks t where t.id = task_id and public.is_project_staff(t.project_id))
  );

-- reminders & audit: staff
create policy reminders_select on public.reminders for select to authenticated
  using (public.is_project_pm(project_id));
create policy audit_select on public.audit_log for select to authenticated
  using (project_id is not null and public.is_project_staff(project_id));

-- notifications / push: own rows only
create policy notifications_select on public.notifications for select to authenticated
  using (profile_id = public.current_profile_id());
create policy notifications_update on public.notifications for update to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
create policy push_own on public.push_subscriptions for all to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());

-- ─────────────────────────────────────────────────────────────
-- Link auth users to profiles on sign-up (phone OTP or email)
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_profile uuid;
  v_digits text := nullif(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), '');
begin
  -- 1. a profile the PM already created for this phone / email
  select id into v_profile from public.profiles
   where auth_user_id is null
     and ((v_digits is not null and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_digits)
          or (new.email is not null and lower(email) = lower(new.email)))
   order by created_at
   limit 1;

  if v_profile is not null then
    update public.profiles set auth_user_id = new.id where id = v_profile;
  else
    -- 2. otherwise a fresh profile with no project access yet
    insert into public.profiles (auth_user_id, full_name, phone, email)
    values (new.id,
            coalesce(new.raw_user_meta_data ->> 'full_name', new.email, new.phone, 'משתמש חדש'),
            case when v_digits is null then null else '+' || v_digits end,
            new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ─────────────────────────────────────────────────────────────
-- Realtime: chat and live graph
-- ─────────────────────────────────────────────────────────────
alter table public.messages replica identity full;
alter table public.tasks replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.messages,
      public.conversation_participants,
      public.tasks,
      public.dependencies,
      public.completion_reports,
      public.notifications;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Storage: one private bucket; files are served through /api/files which
-- checks the session and hands out short-lived signed URLs.
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public)
    values ('media', 'media', false)
    on conflict (id) do nothing;
  end if;
end;
$$;
