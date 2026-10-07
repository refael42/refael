-- Where an imported task came from (e.g. "תוכנית השלמה#4"), so re-importing an
-- updated spreadsheet updates the same tasks instead of duplicating them.
alter table public.tasks add column if not exists external_ref text;
create unique index if not exists tasks_external_ref_idx on public.tasks (project_id, external_ref) where external_ref is not null;

-- dependencies that came from an imported spreadsheet (re-import may remove them)
alter table public.dependencies drop constraint if exists dependencies_source_check;
alter table public.dependencies add constraint dependencies_source_check check (source in ('manual', 'template', 'ai', 'learned', 'import'));
