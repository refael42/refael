-- Setup mode: while a project is being set up (or captured mid-way), contractors
-- get no automatic messages and no reminders run. The PM turns it off when ready.
alter table public.projects add column if not exists setup_mode boolean not null default false;

-- project-level events (created, setup mode) in the audit trail
alter table public.audit_log drop constraint if exists audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('task', 'dependency', 'blocker', 'report', 'message', 'rule', 'plan', 'project'));
