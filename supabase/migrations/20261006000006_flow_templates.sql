-- Each company can customise the master construction process (stages,
-- order, waiting times). No row = the built-in process.
create table if not exists public.flow_templates (
  organization_id  uuid primary key references public.organizations(id) on delete cascade,
  stages           jsonb not null,
  updated_by       uuid references public.profiles(id) on delete set null,
  updated_at       timestamptz not null default now()
);

alter table public.flow_templates enable row level security;

create policy flow_templates_select on public.flow_templates for select to authenticated
  using (public.is_org_member(organization_id));
create policy flow_templates_write on public.flow_templates for all to authenticated
  using (public.is_org_pm(organization_id)) with check (public.is_org_pm(organization_id));

grant all on public.flow_templates to anon, authenticated, service_role;
